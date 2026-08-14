import SwiftUI

struct AdminPlatformToolsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            PlatformSectionTitle(title: "Настройки платформы")
            NavigationLink { AdminFeatureFlagsView() } label: { row("Доступность функций", "Глобальные флаги и правила запуска", "switch.2") }.buttonStyle(.plain).accessibilityIdentifier("admin.flags")
            NavigationLink { AdminAuditView() } label: { row("Журнал действий", "Неизменяемая история административных операций", "list.clipboard") }.buttonStyle(.plain).accessibilityIdentifier("admin.audit")
            NavigationLink { AnalyticsView() } label: { row("Аналитика списаний", "Динамика, точки и оценка потерь", "chart.bar.xaxis") }.buttonStyle(.plain).accessibilityIdentifier("admin.analytics")
        }
    }
    private func row(_ title: String, _ subtitle: String, _ icon: String) -> some View {
        PlatformCard { HStack(spacing: 14) { Image(systemName: icon).font(.title2).foregroundStyle(AppColor.green).frame(width: 46, height: 46).background(AppColor.greenTint).clipShape(RoundedRectangle(cornerRadius: 13)); VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline).foregroundStyle(AppColor.text); Text(subtitle).font(.caption).foregroundStyle(AppColor.muted) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } }
    }
}

struct AdminFeatureFlagsView: View {
    @EnvironmentObject private var settings: AppSettings
    @State private var flags: [[String: Any]] = []
    @State private var loading = true
    @State private var mutatingKey: String?
    @State private var users: [User] = []
    @State private var stores: [Store] = []
    @State private var editor: FeatureFlagEditorState?

    var body: some View {
        Group {
            if loading && flags.isEmpty { PlatformLoadingView() }
            else {
                PlatformScreen("Доступность функций", subtitle: "Изменения применяются ко всем ролям без выпуска новой версии") {
                    ForEach(Array(flags.enumerated()), id: \.offset) { _, flag in
                        PlatformCard {
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(string(flag["description"], fallback: string(flag["key"]))).font(.headline)
                                    Text(string(flag["key"])).font(.caption.monospaced()).foregroundStyle(AppColor.muted)
                                    let targets = flag["targets"] as? [[String: Any]] ?? []
                                    if !targets.isEmpty { Text("Точечных правил: \(targets.count)").font(.caption).foregroundStyle(AppColor.orange) }
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 8) {
                                    Toggle("", isOn: Binding(get: { (flag["enabled_by_default"] as? NSNumber)?.boolValue ?? false }, set: { value in Task { await update(flag, value: value) } })).labelsHidden().disabled(mutatingKey != nil)
                                    Button("Исключения") { editor = FeatureFlagEditorState(flag: flag) }.font(.caption.bold()).frame(minHeight: 36)
                                }
                            }
                        }
                    }
                }.refreshable { await load() }
            }
        }
        .sheet(item: $editor) { value in FeatureFlagRulesSheet(state: value, users: users, stores: stores) { await load() } }
        .task { await load() }.navigationTitle("Функции").platformNavigationStyle()
    }

    private func load() async {
        loading = true; defer { loading = false }
        async let flagResult = try? APIClient.shared.json("admin/platform/feature-flags")
        async let userResult = try? APIClient.shared.adminUsers()
        async let storeResult = try? APIClient.shared.adminStores()
        let values = await (flagResult, userResult, storeResult)
        flags = values.0?["feature_flags"] as? [[String: Any]] ?? flags
        users = values.1?.users ?? users; stores = values.2?.stores ?? stores
    }
    private func update(_ flag: [String: Any], value: Bool) async {
        let key = string(flag["key"]); mutatingKey = key; defer { mutatingKey = nil }
        do { _ = try await APIClient.shared.json("admin/platform/feature-flags/\(key)", method: "PUT", body: ["enabled_by_default": value]); await load(); settings.showToast("Настройка сохранена") }
        catch { settings.showToast(error.localizedDescription) }
    }
}

private struct FeatureRuleDraft: Identifiable {
    let id = UUID()
    var type: String
    var value: String
    var enabled: Bool
}

private struct FeatureFlagEditorState: Identifiable {
    let id = UUID()
    let key: String
    let description: String
    let enabledByDefault: Bool
    var rules: [FeatureRuleDraft]

    init(flag: [String: Any]) {
        key = string(flag["key"]); description = string(flag["description"])
        enabledByDefault = (flag["enabled_by_default"] as? NSNumber)?.boolValue ?? false
        rules = (flag["targets"] as? [[String: Any]] ?? []).map {
            FeatureRuleDraft(type: string($0["target_type"], fallback: "role"), value: string($0["target_value"], fallback: Role.sender), enabled: ($0["enabled"] as? NSNumber)?.boolValue ?? true)
        }
    }
}

private struct FeatureFlagRulesSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: AppSettings
    @State var state: FeatureFlagEditorState
    let users: [User]
    let stores: [Store]
    let onSaved: () async -> Void
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section { Text("Правило аккаунта имеет приоритет над ролью, а роль — над торговой точкой.").font(.caption).foregroundStyle(AppColor.muted) }
                Section("Правила") {
                    if state.rules.isEmpty { Text("Исключений пока нет").foregroundStyle(AppColor.muted) }
                    ForEach($state.rules) { $rule in
                        VStack(alignment: .leading, spacing: 10) {
                            Picker("Тип", selection: $rule.type) { Text("Роль").tag("role"); Text("Точка").tag("store"); Text("Аккаунт").tag("user") }
                                .onChange(of: rule.type) { _, type in rule.value = defaultValue(type) }
                            Picker("Значение", selection: $rule.value) {
                                if rule.type == "role" { ForEach([Role.sender, Role.manager, Role.reviewer, Role.hr, Role.finance, Role.operations, Role.admin], id: \.self) { Text(roleTitle($0)).tag($0) } }
                                else if rule.type == "store" { ForEach(stores) { Text($0.name).tag(String($0.id)) } }
                                else { ForEach(users) { Text("\($0.fullName) · @\($0.username)").tag(String($0.id)) } }
                            }
                            Toggle("Доступ включён", isOn: $rule.enabled)
                            Button("Удалить правило", role: .destructive) { state.rules.removeAll { $0.id == rule.id } }
                        }.padding(.vertical, 4)
                    }
                    Button { state.rules.append(FeatureRuleDraft(type: "role", value: Role.sender, enabled: true)) } label: { Label("Добавить правило", systemImage: "plus") }
                }
            }
            .navigationTitle("Исключения: \(state.key)").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Отмена") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(saving ? "Сохраняем…" : "Сохранить") { Task { await save() } }.disabled(saving || invalidRules) }
            }
        }
    }

    private var invalidRules: Bool {
        state.rules.contains { $0.value.isEmpty } || Set(state.rules.map { "\($0.type):\($0.value)" }).count != state.rules.count
    }
    private func defaultValue(_ type: String) -> String { type == "role" ? Role.sender : type == "store" ? stores.first.map { String($0.id) } ?? "" : users.first.map { String($0.id) } ?? "" }
    private func save() async {
        saving = true; defer { saving = false }
        do {
            _ = try await APIClient.shared.json("admin/platform/feature-flags/\(state.key)", method: "PUT", body: [
                "enabled_by_default": state.enabledByDefault, "description": state.description,
                "targets": state.rules.map { ["target_type": $0.type, "target_value": $0.value, "enabled": $0.enabled] },
            ])
            await onSaved(); settings.showToast("Правила доступа сохранены"); dismiss()
        } catch { settings.showToast(error.localizedDescription) }
    }
}

struct AdminAuditView: View {
    @State private var events: [[String: Any]] = []
    @State private var search = ""
    @State private var loading = true

    var body: some View {
        Group {
            if loading && events.isEmpty { PlatformLoadingView() }
            else {
                PlatformScreen("Журнал действий", subtitle: "Кто, когда и что изменил в системе") {
                    ForEach(Array(events.enumerated()), id: \.offset) { _, event in
                        PlatformCard {
                            VStack(alignment: .leading, spacing: 7) {
                                Text(string(event["action"], fallback: "Действие")).font(.headline)
                                Text([string(event["actor_name"]), string(event["store_name"]), string(event["created_at"])].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(AppColor.muted)
                                Text("\(string(event["entity_type"])) #\(int(event["entity_id"]))").font(.caption.monospaced()).foregroundStyle(AppColor.faint)
                            }
                        }
                    }
                }.refreshable { await load() }.searchable(text: $search, prompt: "Фильтр по действию").onSubmit(of: .search) { Task { await load() } }
            }
        }.task { await load() }.navigationTitle("Журнал").platformNavigationStyle()
    }
    private func load() async { loading = true; defer { loading = false }; let query = search.isEmpty ? "" : "&action=\(search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"; let result = try? await APIClient.shared.json("admin/platform/audit?per_page=100\(query)"); events = result?["events"] as? [[String: Any]] ?? events }
}
