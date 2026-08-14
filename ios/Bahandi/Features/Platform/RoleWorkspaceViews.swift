import SwiftUI

enum WorkspaceKind {
    case manager, hr, finance, operations, admin

    var title: String {
        switch self { case .manager: return "Управление точкой"; case .hr: return "HR"; case .finance: return "Финансы"; case .operations: return "Операционный центр"; case .admin: return "Управление системой" }
    }
    var subtitle: String {
        switch self { case .manager: return "Команда, смены и задачи"; case .hr: return "Сотрудники, обучение и кадровые процессы"; case .finance: return "Подтверждённые часы и расчётные периоды"; case .operations: return "Состояние сети и отклонения"; case .admin: return "Аккаунты, точки и доступность платформы" }
    }
}

struct RoleWorkspaceView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore
    let kind: WorkspaceKind

    var body: some View {
        Group {
            if platform.isLoading && platform.roleWorkspace.isEmpty { PlatformLoadingView() }
            else if let error = platform.errorMessage, platform.roleWorkspace.isEmpty {
                PlatformErrorView(message: error) { Task { await platform.reloadRoleWorkspace(role: auth.role) } }
            } else {
                PlatformScreen(kind.title, subtitle: kind.subtitle) {
                    metrics
                    details
                }
                .refreshable { await platform.reloadRoleWorkspace(role: auth.role) }
            }
        }
        .navigationTitle(kind.title).platformNavigationStyle()
    }

    @ViewBuilder private var metrics: some View {
        let rows = metricRows
        if !rows.isEmpty {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(rows) { item in MetricTile(icon: item.icon, value: item.value, label: item.label, tone: item.tone) }
            }
        }
    }

    @ViewBuilder private var details: some View {
        switch kind {
        case .manager:
            ManagerToolsView()
            workspaceSection("Ближайшие смены", values: array("shifts"), titleKeys: ["title"], detailKeys: ["starts_at", "status"])
            workspaceSection("Команда", values: array("team"), titleKeys: ["full_name"], detailKeys: ["role"])
            workspaceSection("Задачи точки", values: array("tasks"), titleKeys: ["title"], detailKeys: ["status", "due_at"])
        case .hr:
            workspaceSection("Сотрудники", values: array("employees"), titleKeys: ["full_name"], detailKeys: ["position", "role"])
            if let requests = dictionary("requests") {
                workspaceSection("Заявки на документы", values: requests["documents"] as? [[String: Any]] ?? [], titleKeys: ["employee_name", "title"], detailKeys: ["reference", "status"])
                workspaceSection("Отпуска", values: requests["leave"] as? [[String: Any]] ?? [], titleKeys: ["employee_name"], detailKeys: ["starts_on", "ends_on"])
            }
        case .finance:
            workspaceSection("Табели", values: array("timecards"), titleKeys: ["employee_name", "user_name"], detailKeys: ["worked_minutes", "status"])
            workspaceSection("Точки", values: array("stores"), titleKeys: ["name"], detailKeys: ["confirmed_minutes", "payroll_ready"])
        case .operations:
            workspaceSection("Точки сети", values: array("stores"), titleKeys: ["name"], detailKeys: ["attention_count", "team"])
            workspaceSection("Требует внимания", values: array("alerts"), titleKeys: ["title"], detailKeys: ["store_name", "count"])
        case .admin:
            AdminPlatformToolsView()
            if let users = dictionary("users"), let roles = users["by_role"] as? [String: Any] {
                PlatformSectionTitle(title: "Аккаунты по ролям")
                ForEach(roles.keys.sorted(), id: \.self) { key in
                    PlatformCard { LabeledContent(roleTitle(key), value: valueText(roles[key])) }
                }
            }
            workspaceSection("Требует внимания", values: array("issues"), titleKeys: ["title"], detailKeys: ["count"])
            if let audit = dictionary("audit") {
                workspaceSection("Последние действия", values: audit["recent"] as? [[String: Any]] ?? [], titleKeys: ["action"], detailKeys: ["actor_name", "created_at"])
            }
        }
    }

    private var metricRows: [WorkspaceMetric] {
        switch kind {
        case .manager:
            return [metric("person.2", array("team").count, "сотрудников"), metric("calendar", array("shifts").count, "смен"), metric("checklist", array("tasks").count, "задач", AppColor.orange)]
        case .hr:
            let analytics = dictionary("analytics") ?? [:]
            return [metric("person.2", analytics["active_employees"], "активных сотрудников"), metric("person.crop.circle.badge.clock", analytics["on_leave"], "в отпуске"), metric("doc.text", analytics["pending_documents"], "документов", AppColor.orange)]
        case .finance:
            let totals = dictionary("totals") ?? [:]
            return [metric("clock", minutesText(totals["confirmed_minutes"]), "подтверждено"), metric("person.2", totals["employees"], "сотрудников"), metric("building.2", array("stores").count, "точек")]
        case .operations:
            let totals = dictionary("totals") ?? dictionary("summary") ?? [:]
            return [metric("building.2", array("stores").count, "точек"), metric("exclamationmark.triangle", array("alerts").count, "отклонений", AppColor.orange), metric("person.2", totals["team"], "сотрудников")]
        case .admin:
            let users = dictionary("users") ?? [:], stores = dictionary("stores") ?? [:], features = dictionary("features") ?? [:]
            return [metric("person.2", users["active"], "активных аккаунтов"), metric("building.2", stores["active"], "активных точек"), metric("slider.horizontal.3", features["available"], "функций")]
        }
    }

    private func array(_ key: String) -> [[String: Any]] { platform.roleWorkspace[key] as? [[String: Any]] ?? [] }
    private func dictionary(_ key: String) -> [String: Any]? { platform.roleWorkspace[key] as? [String: Any] }

    @ViewBuilder private func workspaceSection(_ title: String, values: [[String: Any]], titleKeys: [String], detailKeys: [String]) -> some View {
        if !values.isEmpty {
            PlatformSectionTitle(title: title)
            ForEach(Array(values.prefix(12).enumerated()), id: \.offset) { _, row in
                PlatformCard {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(firstValue(row, keys: titleKeys) ?? "Запись").font(.headline).foregroundStyle(AppColor.text)
                        let details = detailKeys.compactMap { key -> String? in
                            guard let value = row[key], !(value is NSNull) else { return nil }
                            return prettyKey(key) + ": " + valueText(value)
                        }
                        if !details.isEmpty { Text(details.joined(separator: " · ")).font(.caption).foregroundStyle(AppColor.muted).lineLimit(3) }
                    }
                }
            }
        }
    }
}

private struct WorkspaceMetric: Identifiable {
    let id = UUID(); let icon: String; let value: String; let label: String; let tone: Color
}

private func metric(_ icon: String, _ value: Any?, _ label: String, _ tone: Color = AppColor.green) -> WorkspaceMetric {
    WorkspaceMetric(icon: icon, value: valueText(value), label: label, tone: tone)
}
func minutesText(_ value: Any?) -> String {
    let minutes = (value as? NSNumber)?.intValue ?? 0
    return "\(minutes / 60) ч \(minutes % 60) мин"
}
private func firstValue(_ row: [String: Any], keys: [String]) -> String? {
    for key in keys { if let value = row[key], !(value is NSNull) { return valueText(value) } }
    return nil
}
func valueText(_ value: Any?) -> String {
    guard let value, !(value is NSNull) else { return "0" }
    if let number = value as? NSNumber {
        return CFGetTypeID(number) == CFBooleanGetTypeID() ? (number.boolValue ? "Да" : "Нет") : number.stringValue
    }
    return String(describing: value)
}
private func prettyKey(_ key: String) -> String {
    ["starts_at": "Начало", "status": "Статус", "role": "Роль", "due_at": "Срок", "worked_minutes": "Минуты", "attention_count": "Отклонения", "team": "Команда", "count": "Количество", "ends_on": "По", "starts_on": "С", "iiko_store_id": "iiko", "is_active": "Активна"][key] ?? key
}

struct PlatformApprovalsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var settings: AppSettings
    @State private var data: [String: Any] = [:]
    @State private var loading = false
    @State private var actionID: String?
    @State private var error: String?
    @State private var documentTarget: [String: Any]?
    @State private var documentURL = ""

    private let groups: [(String, String, String)] = [
        ("shift_requests", "Запросы на смены", "calendar.badge.clock"),
        ("timecards", "Табели", "clock.badge.checkmark"),
        ("time_corrections", "Корректировки времени", "clock.arrow.circlepath"),
        ("tasks", "Выполненные задачи", "checklist.checked"),
        ("document_requests", "Документы", "doc.text"),
        ("leave_requests", "Отпуска", "calendar.badge.exclamationmark"),
    ]

    var body: some View {
        Group {
            if loading && data.isEmpty { PlatformLoadingView() }
            else if let error, data.isEmpty { PlatformErrorView(message: error) { Task { await load() } } }
            else {
                PlatformScreen("Согласования", subtitle: "Решения сразу отправляются в рабочий контур") {
                    let total = groups.reduce(0) { $0 + rows($1.0).count }
                    MetricTile(icon: "checkmark.circle", value: "\(total)", label: "ожидают решения", tone: total > 0 ? AppColor.orange : AppColor.green)
                    if total == 0 {
                        ContentUnavailableView("Очередь пуста", systemImage: "checkmark.circle",
                                               description: Text("Новых запросов для вашей роли нет."))
                            .frame(maxWidth: .infinity, minHeight: 260)
                    }
                    ForEach(groups, id: \.0) { group in
                        if !rows(group.0).isEmpty {
                            PlatformSectionTitle(title: group.1)
                            ForEach(Array(rows(group.0).enumerated()), id: \.offset) { _, row in approvalCard(group: group.0, icon: group.2, row: row) }
                        }
                    }
                }.refreshable { await load() }
            }
        }
        .task { await load() }
        .sheet(isPresented: Binding(get: { documentTarget != nil }, set: { if !$0 { documentTarget = nil; documentURL = "" } })) {
            NavigationStack {
                Form {
                    Section("Готовый документ") {
                        TextField("HTTPS-ссылка на файл", text: $documentURL).textInputAutocapitalization(.never).keyboardType(.URL)
                        Text("Ссылка будет доступна только владельцу запроса через его кабинет.").font(.caption).foregroundStyle(AppColor.muted)
                    }
                }
                .navigationTitle("Выдать документ").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Отмена") { documentTarget = nil } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Готово") { if let row = documentTarget { Task { await decide(group: "document_requests", row: row, approve: true, fileURL: documentURL); documentTarget = nil } } }
                            .disabled(!documentURL.lowercased().hasPrefix("https://"))
                    }
                }
            }
        }
        .navigationTitle("Согласования").platformNavigationStyle()
    }

    private func rows(_ key: String) -> [[String: Any]] { data[key] as? [[String: Any]] ?? [] }

    private func approvalCard(group: String, icon: String, row: [String: Any]) -> some View {
        let id = (row["request_id"] as? NSNumber)?.intValue ?? (row["id"] as? NSNumber)?.intValue ?? 0
        let key = "\(group)-\(id)"
        return PlatformCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: icon).font(.title3).foregroundStyle(AppColor.green)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(firstValue(row, keys: ["employee_name", "requester_name", "title", "reference"]) ?? "Запрос #\(id)").font(.headline)
                        Text(approvalDetails(row)).font(.caption).foregroundStyle(AppColor.muted).lineLimit(3)
                    }
                }
                HStack(spacing: 10) {
                    Button { Task { await decide(group: group, row: row, approve: false) } } label: { Text("Отклонить").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(.bordered).tint(AppColor.red)
                    Button {
                        if group == "document_requests" { documentTarget = row }
                        else { Task { await decide(group: group, row: row, approve: true) } }
                    } label: {
                        if actionID == key { ProgressView().frame(maxWidth: .infinity, minHeight: 44) }
                        else { Text("Одобрить").frame(maxWidth: .infinity, minHeight: 44) }
                    }.buttonStyle(.borderedProminent).tint(AppColor.green)
                }.disabled(actionID != nil)
            }
        }
    }

    private func load() async {
        guard [Role.manager, Role.hr, Role.operations, Role.admin, Role.reviewer].contains(auth.role) else { data = [:]; return }
        loading = true; error = nil
        do {
            if auth.role == Role.hr {
                let workspace = try await APIClient.shared.json("hr/workspace")
                let requests = workspace["requests"] as? [String: Any] ?? [:]
                data = [
                    "document_requests": requests["documents"] as? [[String: Any]] ?? [],
                    "leave_requests": requests["leave"] as? [[String: Any]] ?? [],
                ]
            } else {
                data = try await APIClient.shared.json("manager/today")
            }
        }
        catch { self.error = error.localizedDescription }
        loading = false
    }

    private func decide(group: String, row: [String: Any], approve: Bool, fileURL: String? = nil) async {
        let id = (row["request_id"] as? NSNumber)?.intValue ?? (row["id"] as? NSNumber)?.intValue ?? 0
        let version = (row["version"] as? NSNumber)?.intValue ?? 1
        actionID = "\(group)-\(id)"; defer { actionID = nil }
        let path: String
        let decision: String
        switch group {
        case "shift_requests": path = "shifts/manager/requests/\(id)/decision"; decision = approve ? "approved" : "rejected"
        case "timecards": path = "time/manager/timecards/\(id)/decision"; decision = approve ? "approved" : "rejected"
        case "time_corrections": path = "time/manager/corrections/\(id)/decision"; decision = approve ? "approved" : "rejected"
        case "tasks": path = "tasks/manager/\(id)/review"; decision = approve ? "approved" : "rejected"
        case "document_requests": path = "employee-services/manager/documents/requests/\(id)/decision"; decision = approve ? "ready" : "rejected"
        default: path = "employee-services/manager/leave/requests/\(id)/decision"; decision = approve ? "approved" : "rejected"
        }
        var body: [String: Any?] = ["decision": decision, "version": version]
        if group == "document_requests", approve {
            guard let fileURL, fileURL.lowercased().hasPrefix("https://") else { settings.showToast("Укажите корректную HTTPS-ссылку"); return }
            body["file_url"] = fileURL
        }
        do {
            _ = try await APIClient.shared.json(path, method: "POST", body: body, headers: ["Idempotency-Key": UUID().uuidString])
            settings.showToast(approve ? "Решение принято" : "Запрос отклонён"); await load()
        } catch { settings.showToast(error.localizedDescription) }
    }

    private func approvalDetails(_ row: [String: Any]) -> String {
        ["reference", "request_type", "starts_on", "ends_on", "worked_minutes", "status"]
            .compactMap { key in row[key].map { prettyKey(key) + ": " + valueText($0) } }.joined(separator: " · ")
    }
}
