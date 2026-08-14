import SwiftUI

struct ManagerToolsView: View {
    @EnvironmentObject private var platform: PlatformStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            PlatformSectionTitle(title: "Инструменты руководителя")
            NavigationLink { ManagerShiftsView() } label: { tool("Смены и команда", "Создание, публикация и назначения", "calendar.badge.plus") }.buttonStyle(.plain).accessibilityIdentifier("manager.shifts")
            NavigationLink { ManagerTasksView() } label: { tool("Задачи точки", "Назначение, редактирование и отмена", "checklist") }.buttonStyle(.plain).accessibilityIdentifier("manager.tasks")
            NavigationLink { ManagerAnalyticsView() } label: { tool("Аналитика точки", "Часы, задачи, обращения и списания", "chart.xyaxis.line") }.buttonStyle(.plain).accessibilityIdentifier("manager.analytics")
            if platform.hasPermission("news.manage") {
                NavigationLink { ManagerNewsView() } label: { tool("Новости команды", "Публикации для ролей и точек", "megaphone") }.buttonStyle(.plain).accessibilityIdentifier("manager.news")
            }
            if platform.hasPermission("cases.manage") {
                NavigationLink { PlatformSupportView() } label: { tool("Обращения", "Ответы сотрудникам и статусы", "bubble.left.and.exclamationmark.bubble.right") }.buttonStyle(.plain).accessibilityIdentifier("manager.cases")
            }
        }
    }

    private func tool(_ title: String, _ subtitle: String, _ icon: String) -> some View {
        PlatformCard {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.title2).foregroundStyle(AppColor.green)
                    .frame(width: 46, height: 46).background(AppColor.greenTint).clipShape(RoundedRectangle(cornerRadius: 13))
                VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline).foregroundStyle(AppColor.text); Text(subtitle).font(.caption).foregroundStyle(AppColor.muted) }
                Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint)
            }
        }
    }
}

struct ManagerShiftsView: View {
    @EnvironmentObject private var settings: AppSettings
    @State private var workspace: [String: Any] = [:]
    @State private var loading = true
    @State private var showCreate = false
    @State private var error: String?

    private var shifts: [[String: Any]] { workspace["shifts"] as? [[String: Any]] ?? [] }
    private var stores: [[String: Any]] { workspace["stores"] as? [[String: Any]] ?? [] }
    private var team: [[String: Any]] { workspace["team"] as? [[String: Any]] ?? [] }

    var body: some View {
        Group {
            if loading && workspace.isEmpty { PlatformLoadingView() }
            else if let error, workspace.isEmpty { PlatformErrorView(message: error) { Task { await load() } } }
            else {
                PlatformScreen("Смены и команда", subtitle: "Управление расписанием в реальном контуре") {
                    PlatformPrimaryButton(title: "Создать смену", icon: "plus") { showCreate = true }
                    if shifts.isEmpty { ContentUnavailableView("Смен пока нет", systemImage: "calendar", description: Text("Создайте первую смену для точки.")) }
                    ForEach(Array(shifts.enumerated()), id: \.offset) { _, shift in
                        NavigationLink { ManagerShiftDetailView(shiftID: int(shift["id"]), initial: shift, team: team) { await load() } } label: {
                            PlatformCard {
                                HStack(alignment: .top, spacing: 12) {
                                    Image(systemName: "calendar").font(.title2).foregroundStyle(AppColor.green)
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text(string(shift["title"], fallback: "Рабочая смена")).font(.headline).foregroundStyle(AppColor.text)
                                        Text(shiftPeriod(shift)).font(.subheadline).foregroundStyle(AppColor.muted)
                                        Text("\(statusTitle(string(shift["status"]))) · мест: \(int(shift["headcount"]))")
                                            .font(.caption).foregroundStyle(AppColor.muted)
                                    }
                                    Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint)
                                }
                            }
                        }.buttonStyle(.plain)
                    }
                }.refreshable { await load() }
            }
        }
        .sheet(isPresented: $showCreate) { ManagerShiftForm(stores: stores) { await load() } }
        .task { await load() }.navigationTitle("Смены").platformNavigationStyle()
    }

    private func load() async {
        loading = true; defer { loading = false }
        do { workspace = try await APIClient.shared.json("manager/workspace"); error = nil }
        catch { self.error = error.localizedDescription }
    }
}

private struct ManagerShiftForm: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: AppSettings
    let stores: [[String: Any]]
    var existing: [String: Any]? = nil
    let onSaved: () async -> Void
    @State private var storeID = 0
    @State private var title = "Рабочая смена"
    @State private var roleName = "Сотрудник кухни"
    @State private var start = Date().addingTimeInterval(3600)
    @State private var end = Date().addingTimeInterval(9 * 3600)
    @State private var headcount = 1
    @State private var breakMinutes = 30
    @State private var notes = ""
    @State private var publish = true
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Picker("Точка", selection: $storeID) { Text("Выберите точку").tag(0); ForEach(stores, id: \.idValue) { Text(string($0["name"])).tag(int($0["id"])) } }
                TextField("Название", text: $title)
                TextField("Роль на смене", text: $roleName)
                DatePicker("Начало", selection: $start)
                DatePicker("Окончание", selection: $end, in: start...)
                Stepper("Количество мест: \(headcount)", value: $headcount, in: 1...100)
                Stepper("Перерыв: \(breakMinutes) мин", value: $breakMinutes, in: 0...180, step: 5)
                TextField("Комментарий", text: $notes, axis: .vertical).lineLimit(2...5)
                Toggle("Опубликовать сразу", isOn: $publish)
            }
            .navigationTitle(existing == nil ? "Новая смена" : "Редактирование смены").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Отмена") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(saving ? "Сохраняем…" : "Сохранить") { Task { await save() } }.disabled(storeID == 0 || title.isEmpty || end <= start || saving) }
            }
        }
        .onAppear {
            guard let existing else { storeID = stores.first.map { int($0["id"]) } ?? 0; return }
            storeID = int(existing["store_id"]); title = string(existing["title"], fallback: title)
            roleName = string(existing["role_name"], fallback: roleName); headcount = max(1, int(existing["headcount"]))
            breakMinutes = int(existing["break_minutes"]); notes = string(existing["notes"])
            if let value = string(existing["starts_at"]).platformDate { start = value }
            if let value = string(existing["ends_at"]).platformDate { end = value }
            publish = false
        }
    }

    private func save() async {
        saving = true; defer { saving = false }
        do {
            let path = existing.map { "shifts/manager/\(int($0["id"]))" } ?? "shifts/manager"
            let method = existing == nil ? "POST" : "PATCH"
            let response = try await APIClient.shared.json(path, method: method, body: [
                "store_id": storeID, "title": title, "role_name": roleName,
                "starts_at": iso(start), "ends_at": iso(end), "headcount": headcount,
                "break_minutes": breakMinutes, "notes": notes, "version": existing.map { int($0["version"]) },
            ], headers: ["Idempotency-Key": UUID().uuidString])
            if existing == nil, publish, let shift = response["shift"] as? [String: Any] {
                _ = try await APIClient.shared.json("shifts/manager/\(int(shift["id"]))/publish", method: "POST", headers: ["Idempotency-Key": UUID().uuidString])
            }
            await onSaved(); settings.showToast(existing == nil ? "Смена создана" : "Смена обновлена"); dismiss()
        } catch { settings.showToast(error.localizedDescription) }
    }
}

private struct ManagerShiftDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: AppSettings
    let shiftID: Int
    @State var initial: [String: Any]
    let team: [[String: Any]]
    let onChanged: () async -> Void
    @State private var assigning = false
    @State private var cancelReason = ""
    @State private var showCancel = false
    @State private var showEdit = false

    var body: some View {
        PlatformScreen(string(initial["title"], fallback: "Смена"), subtitle: shiftPeriod(initial)) {
            HStack(spacing: 10) { MetricTile(icon: "person.2", value: "\((initial["assignments"] as? [[String: Any]])?.count ?? 0)/\(int(initial["headcount"]))", label: "назначено"); MetricTile(icon: "cup.and.saucer", value: "\(int(initial["break_minutes"])) мин", label: "перерыв", tone: AppColor.orange) }
            if !["cancelled", "completed"].contains(string(initial["status"])) {
                Button { showEdit = true } label: { Label("Изменить смену", systemImage: "pencil").frame(maxWidth: .infinity, minHeight: 52) }.buttonStyle(.bordered).tint(AppColor.green)
            }
            PlatformSectionTitle(title: "Назначения")
            let assignments = initial["assignments"] as? [[String: Any]] ?? []
            if assignments.isEmpty { PlatformCard { Text("Сотрудники не назначены").foregroundStyle(AppColor.muted) } }
            ForEach(Array(assignments.enumerated()), id: \.offset) { _, assignment in
                PlatformCard {
                    HStack {
                        Text(assignmentName(assignment)).font(.headline)
                        Spacer()
                        Button(role: .destructive) { Task { await remove(assignment) } } label: { Image(systemName: "person.badge.minus").frame(width: 44, height: 44) }.disabled(assigning)
                    }
                }
            }
            Menu {
                ForEach(team.filter { member in !(assignments.contains { int($0["user_id"]) == int(member["id"]) }) }, id: \.idValue) { member in
                    Button(string(member["full_name"])) { Task { await assign(member) } }
                }
            } label: { Label("Назначить сотрудника", systemImage: "person.badge.plus").frame(maxWidth: .infinity, minHeight: 52) }
                .buttonStyle(.bordered).tint(AppColor.green).disabled(assigning)
            if string(initial["status"]) != "cancelled" {
                Button("Отменить смену", role: .destructive) { showCancel = true }.frame(maxWidth: .infinity, minHeight: 52).buttonStyle(.bordered)
            }
        }
        .alert("Отмена смены", isPresented: $showCancel) {
            TextField("Причина", text: $cancelReason)
            Button("Отменить смену", role: .destructive) { Task { await cancel() } }.disabled(cancelReason.count < 3 && string(initial["status"]) == "published")
            Button("Назад", role: .cancel) {}
        } message: { Text("Назначенные сотрудники получат уведомление.") }
        .sheet(isPresented: $showEdit) {
            ManagerShiftForm(stores: uniqueStores, existing: initial) { await refresh() }
        }
        .navigationTitle("Смена").platformNavigationStyle()
    }

    private func assign(_ member: [String: Any]) async {
        assigning = true; defer { assigning = false }
        do { _ = try await APIClient.shared.json("shifts/manager/\(shiftID)/assignments", method: "POST", body: ["user_id": int(member["id"])], headers: ["Idempotency-Key": UUID().uuidString]); await refresh(); settings.showToast("Сотрудник назначен") }
        catch { settings.showToast(error.localizedDescription) }
    }
    private func remove(_ assignment: [String: Any]) async {
        assigning = true; defer { assigning = false }
        do { _ = try await APIClient.shared.json("shifts/manager/\(shiftID)/assignments/\(int(assignment["user_id"]))", method: "DELETE", body: ["version": int(initial["version"]), "reason": "Снято менеджером"], headers: ["Idempotency-Key": UUID().uuidString]); await refresh(); settings.showToast("Сотрудник снят со смены") }
        catch { settings.showToast(error.localizedDescription) }
    }
    private func cancel() async {
        do { _ = try await APIClient.shared.json("shifts/manager/\(shiftID)/cancel", method: "POST", body: ["version": int(initial["version"]), "reason": cancelReason], headers: ["Idempotency-Key": UUID().uuidString]); await onChanged(); settings.showToast("Смена отменена"); dismiss() }
        catch { settings.showToast(error.localizedDescription) }
    }
    private func refresh() async {
        if let workspace = try? await APIClient.shared.json("manager/workspace"), let shifts = workspace["shifts"] as? [[String: Any]], let value = shifts.first(where: { int($0["id"]) == shiftID }) { initial = value; await onChanged() }
    }
    private func assignmentName(_ row: [String: Any]) -> String {
        if let user = row["user"] as? [String: Any] { return string(user["full_name"], fallback: "Сотрудник #\(int(row["user_id"]))") }
        return string(row["user_name"], fallback: "Сотрудник #\(int(row["user_id"]))")
    }
    private var uniqueStores: [[String: Any]] {
        if let store = initial["store"] as? [String: Any] { return [store] }
        return [["id": int(initial["store_id"]), "name": "Текущая точка"]]
    }
}

struct ManagerTasksView: View {
    @EnvironmentObject private var settings: AppSettings
    @State private var workspace: [String: Any] = [:]
    @State private var showCreate = false
    @State private var editTask: [String: Any]?
    @State private var loading = true
    private var tasks: [[String: Any]] { workspace["tasks"] as? [[String: Any]] ?? [] }
    private var stores: [[String: Any]] { workspace["stores"] as? [[String: Any]] ?? [] }
    private var team: [[String: Any]] { workspace["team"] as? [[String: Any]] ?? [] }

    var body: some View {
        Group {
            if loading && workspace.isEmpty { PlatformLoadingView() }
            else { PlatformScreen("Задачи точки", subtitle: "Постановка и контроль выполнения") {
                PlatformPrimaryButton(title: "Новая задача", icon: "plus") { showCreate = true }
                ForEach(Array(tasks.enumerated()), id: \.offset) { _, task in
                    PlatformCard { VStack(alignment: .leading, spacing: 9) { HStack { Text(string(task["title"], fallback: "Задача")).font(.headline); Spacer(); Text(statusTitle(string(task["status"]))).font(.caption.bold()).foregroundStyle(AppColor.green) }; Text(string(task["description"], fallback: "Без описания")).font(.subheadline).foregroundStyle(AppColor.muted).lineLimit(2); HStack { Button("Изменить") { editTask = task }.frame(minHeight: 44); Spacer(); Button("Удалить", role: .destructive) { Task { await remove(task) } }.frame(minHeight: 44) } } }
                }
            }.refreshable { await load() } }
        }
        .sheet(isPresented: $showCreate) { ManagerTaskForm(stores: stores, team: team, existing: nil) { await load() } }
        .sheet(isPresented: Binding(get: { editTask != nil }, set: { if !$0 { editTask = nil } })) { if let editTask { ManagerTaskForm(stores: stores, team: team, existing: editTask) { await load() } } }
        .task { await load() }.navigationTitle("Задачи").platformNavigationStyle()
    }
    private func load() async { loading = true; defer { loading = false }; if let value = try? await APIClient.shared.json("manager/workspace") { workspace = value } }
    private func remove(_ task: [String: Any]) async {
        do { _ = try await APIClient.shared.json("tasks/manager/\(int(task["id"]))", method: "DELETE", body: ["version": int(task["version"]), "reason": "Отменено менеджером"], headers: ["Idempotency-Key": UUID().uuidString]); settings.showToast("Задача отменена"); await load() }
        catch { settings.showToast(error.localizedDescription) }
    }
}

private struct ManagerTaskForm: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: AppSettings
    let stores: [[String: Any]]; let team: [[String: Any]]; let existing: [String: Any]?; let onSaved: () async -> Void
    @State private var storeID = 0; @State private var assigneeID = 0; @State private var title = ""; @State private var description = ""; @State private var due = Date().addingTimeInterval(86400); @State private var steps = ""; @State private var saving = false
    var body: some View {
        NavigationStack { Form {
            Picker("Точка", selection: $storeID) { Text("Выберите точку").tag(0); ForEach(stores, id: \.idValue) { Text(string($0["name"])).tag(int($0["id"])) } }
            Picker("Исполнитель", selection: $assigneeID) { Text("Вся команда точки").tag(0); ForEach(team.filter { storeID == 0 || int($0["store_id"]) == storeID }, id: \.idValue) { Text(string($0["full_name"])).tag(int($0["id"])) } }
            TextField("Название", text: $title); TextField("Описание", text: $description, axis: .vertical).lineLimit(2...6); DatePicker("Срок", selection: $due); TextField("Пункты чек-листа, через запятую", text: $steps, axis: .vertical)
        }.navigationTitle(existing == nil ? "Новая задача" : "Редактирование").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Отмена") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Сохранить") { Task { await save() } }.disabled(storeID == 0 || title.isEmpty || saving) } }
        }.onAppear { guard let existing else { storeID = stores.first.map { int($0["id"]) } ?? 0; return }; storeID = int(existing["store_id"]); assigneeID = int(existing["assignee_id"]); title = string(existing["title"]); description = string(existing["description"]); if let value = string(existing["due_at"]).platformDate { due = value }; steps = (existing["steps"] as? [[String: Any]] ?? []).map { string($0["title"]) }.joined(separator: ", ") }
    }
    private func save() async {
        saving = true; defer { saving = false }
        let path = existing.map { "tasks/manager/\(int($0["id"]))" } ?? "tasks/manager"
        let method = existing == nil ? "POST" : "PATCH"
        do { _ = try await APIClient.shared.json(path, method: method, body: ["store_id": storeID, "assignee_id": assigneeID == 0 ? nil : assigneeID, "title": title, "description": description, "due_at": iso(due), "task_type": "operation", "steps": steps.split(separator: ",").map { ["title": $0.trimmingCharacters(in: .whitespaces)] }, "version": existing.map { int($0["version"]) }], headers: ["Idempotency-Key": UUID().uuidString]); await onSaved(); settings.showToast("Задача сохранена"); dismiss() }
        catch { settings.showToast(error.localizedDescription) }
    }
}

struct ManagerAnalyticsView: View {
    @State private var data: [String: Any] = [:]; @State private var days = 30; @State private var loading = true
    private var totals: [String: Any] { data["totals"] as? [String: Any] ?? [:] }
    var body: some View {
        Group { if loading && data.isEmpty { PlatformLoadingView() } else { PlatformScreen("Аналитика точки", subtitle: "Операционные показатели за выбранный период") {
            Picker("Период", selection: $days) { Text("7 дней").tag(7); Text("30 дней").tag(30); Text("90 дней").tag(90) }.pickerStyle(.segmented).onChange(of: days) { _, _ in Task { await load() } }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) { MetricTile(icon: "person.2", value: valueText(totals["team"]), label: "сотрудников"); MetricTile(icon: "clock", value: minutesText(totals["worked_minutes"]), label: "отработано"); MetricTile(icon: "checklist", value: valueText(totals["tasks_completed"]), label: "задач выполнено"); MetricTile(icon: "exclamationmark.bubble", value: valueText(totals["open_cases"]), label: "обращений", tone: AppColor.orange); MetricTile(icon: "camera", value: valueText(totals["writeoffs"]), label: "списаний", tone: AppColor.orange); MetricTile(icon: "calendar", value: valueText(totals["shifts"]), label: "смен") }
            PlatformCard(tint: AppColor.greenTint) { Label("Сводка сформирована сервером \(string(data["generated_at"], fallback: "сейчас"))", systemImage: "checkmark.shield").font(.subheadline) }
        }.refreshable { await load() } } }.task { await load() }.navigationTitle("Аналитика").platformNavigationStyle()
    }
    private func load() async { loading = true; defer { loading = false }; data = (try? await APIClient.shared.json("manager/analytics?days=\(days)")) ?? data }
}

struct ManagerNewsView: View {
    @EnvironmentObject private var settings: AppSettings
    @State private var context: [String: Any] = [:]; @State private var title = ""; @State private var excerpt = ""; @State private var bodyText = ""; @State private var category = "operations"; @State private var audience = "sender"; @State private var storeID = 0; @State private var saving = false
    private var stores: [[String: Any]] { context["stores"] as? [[String: Any]] ?? [] }
    var body: some View {
        PlatformScreen("Новости команды", subtitle: "Публикация сразу появится у выбранной аудитории") {
            PlatformCard { VStack(spacing: 14) {
                TextField("Заголовок", text: $title); Divider(); TextField("Краткое описание", text: $excerpt, axis: .vertical).lineLimit(2...4); Divider(); TextField("Текст новости", text: $bodyText, axis: .vertical).lineLimit(5...12)
                Picker("Рубрика", selection: $category) { Text("Операции").tag("operations"); Text("Обучение").tag("learning"); Text("Команда").tag("team"); Text("Безопасность").tag("safety"); Text("Важно").tag("important") }
                Picker("Аудитория", selection: $audience) { Text("Сотрудники").tag("sender"); Text("Менеджеры").tag("manager"); Text("Все роли").tag("") }
                Picker("Точка", selection: $storeID) { Text("Все доступные точки").tag(0); ForEach(stores, id: \.idValue) { Text(string($0["name"])).tag(int($0["id"])) } }
                HStack(spacing: 10) {
                    Button { Task { await save(status: "draft") } } label: { Text("Сохранить черновик").frame(maxWidth: .infinity, minHeight: 48) }.buttonStyle(.bordered).tint(AppColor.green).disabled(invalid || saving)
                    Button { Task { await save(status: "published") } } label: { if saving { ProgressView().frame(maxWidth: .infinity, minHeight: 48) } else { Label("Опубликовать", systemImage: "paperplane.fill").frame(maxWidth: .infinity, minHeight: 48) } }.buttonStyle(.borderedProminent).tint(AppColor.green).disabled(invalid || saving)
                }
            } }
        }.task { context = (try? await APIClient.shared.json("news/manage-context")) ?? [:]; if stores.count == 1 { storeID = int(stores[0]["id"]) } }.navigationTitle("Новости").platformNavigationStyle()
    }
    private var invalid: Bool { title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || stores.count > 1 && storeID == 0 }
    private func save(status: String) async { saving = true; defer { saving = false }; do { _ = try await APIClient.shared.json("news/manager", method: "POST", body: ["title": title, "excerpt": excerpt, "body": bodyText, "category": category, "audience_role": audience.isEmpty ? nil : audience, "store_id": storeID == 0 ? nil : storeID, "status": status], headers: ["Idempotency-Key": UUID().uuidString]); title = ""; excerpt = ""; bodyText = ""; settings.showToast(status == "published" ? "Новость опубликована" : "Черновик сохранён") } catch { settings.showToast(error.localizedDescription) } }
}

func int(_ value: Any?) -> Int { (value as? NSNumber)?.intValue ?? Int(value as? String ?? "") ?? 0 }
func string(_ value: Any?, fallback: String = "") -> String { guard let value, !(value is NSNull) else { return fallback }; return String(describing: value) }
private func iso(_ date: Date) -> String { ISO8601DateFormatter().string(from: date) }
private func shiftPeriod(_ shift: [String: Any]) -> String { "\(string(shift["starts_at"], fallback: "—")) — \(string(shift["ends_at"], fallback: "—"))" }

extension Dictionary where Key == String, Value == Any {
    var idValue: Int { int(self["id"]) }
}
