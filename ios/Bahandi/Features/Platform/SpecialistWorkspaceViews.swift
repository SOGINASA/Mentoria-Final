import SwiftUI

struct HRWorkspaceView: View {
    @State private var data: [String: Any] = [:]
    @State private var storeID = 0
    @State private var tab = 0
    @State private var search = ""
    @State private var selectedEmployee: [String: Any]?
    @State private var loading = true

    private var stores: [[String: Any]] { data["stores"] as? [[String: Any]] ?? [] }
    private var employees: [[String: Any]] {
        let values = data["employees"] as? [[String: Any]] ?? []
        guard !search.isEmpty else { return values }
        return values.filter { [string($0["full_name"]), string($0["email"]), string($0["phone"])].joined(separator: " ").localizedCaseInsensitiveContains(search) }
    }
    private var analytics: [String: Any] { data["analytics"] as? [String: Any] ?? [:] }
    private var requests: [String: Any] { data["requests"] as? [String: Any] ?? [:] }

    var body: some View {
        Group {
            if loading && data.isEmpty { PlatformLoadingView() }
            else { PlatformScreen("HR-кабинет", subtitle: "Сотрудники, кадровые процессы и обязательное обучение") {
                Picker("Точка", selection: $storeID) { Text("Все точки").tag(0); ForEach(stores, id: \.idValue) { Text(string($0["name"])).tag(int($0["id"])) } }.onChange(of: storeID) { _, _ in Task { await load() } }
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    MetricTile(icon: "person.2", value: valueText(analytics["active_employees"]), label: "сотрудников")
                    MetricTile(icon: "calendar", value: valueText(analytics["on_leave"]), label: "сейчас отсутствуют", tone: AppColor.orange)
                    MetricTile(icon: "doc.text", value: valueText(analytics["pending_documents"]), label: "документов")
                    MetricTile(icon: "book", value: "\(valueText(analytics["learning_compliance"]))%", label: "обучение")
                }
                Picker("Раздел", selection: $tab) { Text("Обзор").tag(0); Text("Люди").tag(1); Text("Обучение").tag(2) }.pickerStyle(.segmented)
                if tab == 0 { overview }
                else if tab == 1 { people }
                else { learning }
            }.refreshable { await load() } }
        }
        .sheet(isPresented: Binding(get: { selectedEmployee != nil }, set: { if !$0 { selectedEmployee = nil } })) { if let employee = selectedEmployee { employeeSheet(employee) } }
        .task { await load() }.navigationTitle("HR").platformNavigationStyle()
    }

    @ViewBuilder private var overview: some View {
        PlatformSectionTitle(title: "Требует внимания")
        NavigationLink { PlatformApprovalsView() } label: { attention("Запросы документов", (requests["documents"] as? [[String: Any]])?.count ?? 0, "doc.text") }.buttonStyle(.plain)
        NavigationLink { PlatformApprovalsView() } label: { attention("Заявки на отсутствие", (requests["leave"] as? [[String: Any]])?.count ?? 0, "calendar") }.buttonStyle(.plain)
        NavigationLink { PlatformSupportView() } label: { attention("HR-обращения", int(requests["open_hr_cases"]), "bubble.left") }.buttonStyle(.plain)
        NavigationLink { ManagerNewsView() } label: { attention("Опубликовать новость", 0, "megaphone") }.buttonStyle(.plain)
        let upcoming = requests["upcoming_leave"] as? [[String: Any]] ?? []
        if !upcoming.isEmpty { PlatformSectionTitle(title: "Ближайшие отсутствия"); ForEach(Array(upcoming.enumerated()), id: \.offset) { _, row in PlatformCard { VStack(alignment: .leading, spacing: 5) { Text(string(row["employee_name"])).font(.headline); Text("\(string(row["starts_on"])) — \(string(row["ends_on"])) · \(int(row["days"])) дн.").font(.caption).foregroundStyle(AppColor.muted) } } } }
    }
    @ViewBuilder private var people: some View {
        TextField("Поиск по ФИО, телефону или почте", text: $search).textFieldStyle(.roundedBorder)
        ForEach(Array(employees.enumerated()), id: \.offset) { _, employee in
            Button { selectedEmployee = employee } label: { PlatformCard { HStack { Text(initials(string(employee["full_name"]))).font(.headline).foregroundStyle(.white).frame(width: 44, height: 44).background(AppColor.green).clipShape(Circle()); VStack(alignment: .leading, spacing: 4) { Text(string(employee["full_name"])).font(.headline).foregroundStyle(AppColor.text); Text(string(employee["position"], fallback: roleTitle(string(employee["role"])))).font(.caption).foregroundStyle(AppColor.muted) }; Spacer(); let learning = employee["learning"] as? [String: Any] ?? [:]; Text("\(valueText(learning["compliance_percent"]))%").font(.caption.bold()).foregroundStyle(AppColor.green); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } } }.buttonStyle(.plain)
        }
    }
    @ViewBuilder private var learning: some View {
        let courses = analytics["courses"] as? [[String: Any]] ?? []
        ForEach(Array(courses.enumerated()), id: \.offset) { _, course in PlatformCard { VStack(alignment: .leading, spacing: 10) { HStack { Text(courseTitle(string(course["course_id"]))).font(.headline); Spacer(); if (course["required"] as? NSNumber)?.boolValue == true { Text("Обязательный").font(.caption.bold()).foregroundStyle(AppColor.orange) } }; ProgressView(value: Double(int(course["percent"])), total: 100).tint(AppColor.green); Text("\(int(course["completed"])) из \(int(course["total"])) сотрудников").font(.caption).foregroundStyle(AppColor.muted) } } }
    }
    private func attention(_ title: String, _ count: Int, _ icon: String) -> some View { PlatformCard { HStack { Image(systemName: icon).foregroundStyle(count > 0 ? AppColor.orange : AppColor.green); Text(title).font(.headline).foregroundStyle(AppColor.text); Spacer(); Text("\(count)").font(.title2.bold()).foregroundStyle(AppColor.text); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } } }
    private func employeeSheet(_ employee: [String: Any]) -> some View { NavigationStack { List { Section("Сотрудник") { LabeledContent("ФИО", value: string(employee["full_name"])); LabeledContent("Должность", value: string(employee["position"], fallback: "Не указана")); LabeledContent("Телефон", value: string(employee["phone"], fallback: "Не указан")); LabeledContent("Почта", value: string(employee["email"], fallback: "Не указана")); LabeledContent("Аккаунт", value: (employee["has_account"] as? NSNumber)?.boolValue == true ? "Подключён" : "Не создан") }; if let learning = employee["learning"] as? [String: Any] { Section("Обучение") { LabeledContent("Прогресс", value: "\(valueText(learning["compliance_percent"]))%"); LabeledContent("Обязательные курсы", value: "\(int(learning["required_completed"]))/\(int(learning["required_total"]))") } } }.navigationTitle(string(employee["full_name"])).navigationBarTitleDisplayMode(.inline) } }
    private func load() async { loading = true; defer { loading = false }; let query = storeID == 0 ? "" : "?store_id=\(storeID)"; if let value = try? await APIClient.shared.json("hr/workspace\(query)") { data = value } }
}

struct FinanceWorkspaceView: View {
    @EnvironmentObject private var settings: AppSettings
    @State private var data: [String: Any] = [:]
    @State private var month = String(ISO8601DateFormatter.platform.string(from: Date()).prefix(7))
    @State private var storeID = 0
    @State private var tab = 0
    @State private var search = ""
    @State private var selectedEmployee: [String: Any]?
    @State private var exportURL: URL?
    @State private var loading = true
    private var stores: [[String: Any]] { data["stores"] as? [[String: Any]] ?? [] }
    private var employees: [[String: Any]] {
        let values = data["employees"] as? [[String: Any]] ?? []
        return search.isEmpty ? values : values.filter { string($0["full_name"]).localizedCaseInsensitiveContains(search) }
    }
    private var analytics: [String: Any] { data["analytics"] as? [String: Any] ?? [:] }
    var body: some View {
        Group { if loading && data.isEmpty { PlatformLoadingView() } else { PlatformScreen("Финансы", subtitle: "Сверка подтверждённых часов без выдуманных ставок") {
            HStack { TextField("YYYY-MM", text: $month).textFieldStyle(.roundedBorder).keyboardType(.numbersAndPunctuation); Button("Применить") { Task { await load() } }.buttonStyle(.bordered) }
            Picker("Точка", selection: $storeID) { Text("Все точки").tag(0); ForEach(stores, id: \.idValue) { Text(string($0["name"])).tag(int($0["id"])) } }.onChange(of: storeID) { _, _ in Task { await load() } }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) { MetricTile(icon: "checkmark.circle", value: minutesText(analytics["approved_minutes"]), label: "подтверждено"); MetricTile(icon: "clock", value: minutesText(analytics["pending_minutes"]), label: "на проверке", tone: AppColor.orange); MetricTile(icon: "person.crop.circle.badge.checkmark", value: valueText(analytics["ready_employees"]), label: "готовы к расчёту"); MetricTile(icon: "exclamationmark.triangle", value: valueText(analytics["attention_employees"]), label: "требуют сверки", tone: AppColor.orange) }
            if let exportURL { ShareLink(item: exportURL) { Label("Поделиться выгрузкой CSV", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity, minHeight: 48) }.buttonStyle(.borderedProminent).tint(AppColor.green) }
            else { Button { Task { await export() } } label: { Label("Подготовить CSV", systemImage: "arrow.down.doc").frame(maxWidth: .infinity, minHeight: 48) }.buttonStyle(.bordered).tint(AppColor.green) }
            Picker("Раздел", selection: $tab) { Text("Сводка").tag(0); Text("Сотрудники").tag(1); Text("Точки").tag(2) }.pickerStyle(.segmented)
            if tab == 0 { financeOverview }
            else if tab == 1 { TextField("Поиск сотрудника", text: $search).textFieldStyle(.roundedBorder); ForEach(Array(employees.enumerated()), id: \.offset) { _, employee in Button { selectedEmployee = employee } label: { financeRow(employee) }.buttonStyle(.plain) } }
            else { let rows = analytics["stores"] as? [[String: Any]] ?? []; ForEach(Array(rows.enumerated()), id: \.offset) { _, row in PlatformCard { VStack(alignment: .leading, spacing: 8) { HStack { Text(string(row["name"])).font(.headline); Spacer(); Text(minutesText(row["approved_minutes"])).font(.headline).monospacedDigit() }; Text("Готово: \(int(row["ready_employees"])) · требуют сверки: \(int(row["attention_employees"]))").font(.caption).foregroundStyle(AppColor.muted); ProgressView(value: Double(int(row["approved_minutes"])), total: Double(max(1, int(row["approved_minutes"]) + int(row["pending_minutes"])))).tint(AppColor.green) } } } }
            PlatformCard(tint: AppColor.orangeTint) { Label("Официальный payroll и ставки не подключены. Здесь отображается только подтверждённое рабочее время.", systemImage: "info.circle").font(.subheadline) }
        }.refreshable { await load() } } }
        .sheet(isPresented: Binding(get: { selectedEmployee != nil }, set: { if !$0 { selectedEmployee = nil } })) { if let employee = selectedEmployee { NavigationStack { List { LabeledContent("Подтверждено", value: minutesText(employee["approved_minutes"])); LabeledContent("На проверке", value: minutesText(employee["pending_minutes"])); LabeledContent("Подтверждённых табелей", value: valueText(employee["approved_timecards"])); LabeledContent("Отклонённых табелей", value: valueText(employee["rejected_timecards"])); LabeledContent("Статус", value: statusTitle(string(employee["readiness"]))) }.navigationTitle(string(employee["full_name"])).navigationBarTitleDisplayMode(.inline) } } }
        .task { await load() }.navigationTitle("Финансы").platformNavigationStyle()
    }
    private func financeRow(_ row: [String: Any]) -> some View { PlatformCard { HStack { VStack(alignment: .leading, spacing: 5) { Text(string(row["full_name"])).font(.headline).foregroundStyle(AppColor.text); Text(statusTitle(string(row["readiness"]))).font(.caption).foregroundStyle(string(row["readiness"]) == "attention" ? AppColor.orange : AppColor.green) }; Spacer(); Text(minutesText(row["approved_minutes"])).font(.headline).foregroundStyle(AppColor.text).monospacedDigit(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } } }
    @ViewBuilder private var financeOverview: some View {
        let attention = employees.filter { string($0["readiness"]) == "attention" }
        PlatformSectionTitle(title: "Требуют сверки")
        if attention.isEmpty { ContentUnavailableView("Расхождений нет", systemImage: "checkmark.circle", description: Text("Все доступные табели готовы или ожидают появления данных.")) }
        ForEach(Array(attention.prefix(8).enumerated()), id: \.offset) { _, employee in Button { selectedEmployee = employee } label: { financeRow(employee) }.buttonStyle(.plain) }
        NavigationLink { PlatformSupportView() } label: { PlatformCard { HStack { Image(systemName: "questionmark.bubble").foregroundStyle(AppColor.orange); VStack(alignment: .leading) { Text("Вопросы по начислениям").font(.headline).foregroundStyle(AppColor.text); Text("Ответить сотрудникам").font(.caption).foregroundStyle(AppColor.muted) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } } }.buttonStyle(.plain)
    }
    private func query() -> String { "month=\(month)" + (storeID == 0 ? "" : "&store_id=\(storeID)") }
    private func load() async { loading = true; defer { loading = false }; if let value = try? await APIClient.shared.json("finance/workspace?\(query())") { data = value; exportURL = nil } }
    private func export() async { do { let value = try await APIClient.shared.data("finance/export?\(query())"); let url = FileManager.default.temporaryDirectory.appendingPathComponent("bahandi-hours-\(month).csv"); try value.write(to: url, options: .atomic); exportURL = url; settings.showToast("CSV подготовлен") } catch { settings.showToast(error.localizedDescription) } }
}

struct OperationsWorkspaceView: View {
    @State private var data: [String: Any] = [:]
    @State private var days = 14
    @State private var storeID = 0
    @State private var tab = 0
    @State private var selectedStore: [String: Any]?
    @State private var loading = true
    private var stores: [[String: Any]] { data["stores"] as? [[String: Any]] ?? [] }
    private var rows: [[String: Any]] { data["store_summaries"] as? [[String: Any]] ?? [] }
    private var alerts: [[String: Any]] { data["alerts"] as? [[String: Any]] ?? [] }
    private var analytics: [String: Any] { data["analytics"] as? [String: Any] ?? [:] }
    var body: some View {
        Group { if loading && data.isEmpty { PlatformLoadingView() } else { PlatformScreen("Операционный центр", subtitle: "Сеть Bahandi по отклонениям и фактическим процессам") {
            Picker("Период", selection: $days) { Text("7 дней").tag(7); Text("14 дней").tag(14); Text("30 дней").tag(30) }.pickerStyle(.segmented).onChange(of: days) { _, _ in Task { await load() } }
            Picker("Точка", selection: $storeID) { Text("Вся сеть").tag(0); ForEach(stores, id: \.idValue) { Text(string($0["name"])).tag(int($0["id"])) } }.onChange(of: storeID) { _, _ in Task { await load() } }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) { MetricTile(icon: "building.2", value: valueText(analytics["active_stores"]), label: "активных точек"); MetricTile(icon: "person.2", value: valueText(analytics["active_employees"]), label: "сотрудников"); MetricTile(icon: "calendar.badge.exclamationmark", value: valueText(analytics["uncovered_slots"]), label: "незакрытых мест", tone: AppColor.orange); MetricTile(icon: "checklist", value: valueText(analytics["overdue_tasks"]), label: "просроченных задач", tone: AppColor.orange) }
            Picker("Раздел", selection: $tab) { Text("Сигналы").tag(0); Text("Точки").tag(1); Text("Динамика").tag(2) }.pickerStyle(.segmented)
            if tab == 0 { if alerts.isEmpty { ContentUnavailableView("Отклонений нет", systemImage: "checkmark.circle", description: Text("Основные процессы находятся в норме.")) }; ForEach(Array(alerts.enumerated()), id: \.offset) { _, row in NavigationLink { alertDestination(row) } label: { alertRow(row) }.buttonStyle(.plain) } }
            else if tab == 1 { ForEach(Array(rows.enumerated()), id: \.offset) { _, row in Button { selectedStore = row } label: { storeRow(row) }.buttonStyle(.plain) } }
            else { trend }
            PlatformSectionTitle(title: "Рабочие инструменты")
            NavigationLink { OperationsManagementView() } label: { operationsTool("Управление точками", "Смены, задачи, новости и обращения", "briefcase") }.buttonStyle(.plain)
            NavigationLink { EmployeeServicesView() } label: { operationsTool("Сервисы сотрудника", "Обучение, документы, отсутствие и помощь", "square.grid.2x2") }.buttonStyle(.plain)
        }.refreshable { await load() } } }
        .sheet(isPresented: Binding(get: { selectedStore != nil }, set: { if !$0 { selectedStore = nil } })) { if let store = selectedStore { NavigationStack { List { Section("Состояние") { LabeledContent("Команда", value: valueText(store["team"])); LabeledContent("Смен сегодня", value: valueText(store["today_shifts"])); LabeledContent("Незакрытые места", value: valueText(store["uncovered_slots"])); LabeledContent("Просроченные задачи", value: valueText(store["overdue_tasks"])); LabeledContent("Табели на проверке", value: valueText(store["submitted_timecards"])); LabeledContent("Обращения", value: valueText(store["open_cases"])); LabeledContent("Списания", value: valueText(store["writeoffs"])) }; Section { NavigationLink("Управление точкой") { OperationsManagementView() } } }.navigationTitle(string(store["name"])).navigationBarTitleDisplayMode(.inline) } } }
        .task { await load() }.navigationTitle("Операции").platformNavigationStyle()
    }
    private func alertRow(_ row: [String: Any]) -> some View { PlatformCard { HStack { Image(systemName: alertIcon(string(row["kind"]))).foregroundStyle(AppColor.orange).frame(width: 40, height: 40).background(AppColor.orangeTint).clipShape(RoundedRectangle(cornerRadius: 11)); VStack(alignment: .leading, spacing: 4) { Text(string(row["title"])).font(.headline); Text(string(row["store_name"])).font(.caption).foregroundStyle(AppColor.muted) }; Spacer(); Text(valueText(row["count"])).font(.title2.bold()) } } }
    @ViewBuilder private func alertDestination(_ row: [String: Any]) -> some View {
        switch string(row["kind"]) {
        case "coverage": ManagerShiftsView()
        case "tasks": ManagerTasksView()
        case "cases": PlatformSupportView()
        default: PlatformApprovalsView()
        }
    }
    private func storeRow(_ row: [String: Any]) -> some View { PlatformCard { VStack(alignment: .leading, spacing: 10) { HStack { Text(string(row["name"])).font(.headline).foregroundStyle(AppColor.text); Spacer(); Text(int(row["attention_count"]) > 0 ? "\(int(row["attention_count"])) сигналов" : "В норме").font(.caption.bold()).foregroundStyle(int(row["attention_count"]) > 0 ? AppColor.orange : AppColor.green) }; HStack { small(valueText(row["uncovered_slots"]), "мест"); small(valueText(row["overdue_tasks"]), "задач"); small(valueText(row["open_cases"]), "обращений") }; Image(systemName: "chevron.right").foregroundStyle(AppColor.faint).frame(maxWidth: .infinity, alignment: .trailing) } } }
    @ViewBuilder private var trend: some View { let values = data["trend"] as? [[String: Any]] ?? []; if values.isEmpty { ContentUnavailableView("Данных пока нет", systemImage: "chart.bar") }; ForEach(Array(values.suffix(14).enumerated()), id: \.offset) { _, row in PlatformCard { VStack(alignment: .leading, spacing: 7) { Text(string(row["date"])).font(.caption.bold()).foregroundStyle(AppColor.muted); LabeledContent("Выполнено задач", value: valueText(row["completed_tasks"])); LabeledContent("Списаний", value: valueText(row["writeoffs"])) } } } }
    private func small(_ value: String, _ label: String) -> some View { VStack { Text(value).font(.headline); Text(label).font(.caption2).foregroundStyle(AppColor.muted) }.frame(maxWidth: .infinity).padding(8).background(AppColor.surface2).clipShape(RoundedRectangle(cornerRadius: 10)) }
    private func load() async { loading = true; defer { loading = false }; let query = "days=\(days)" + (storeID == 0 ? "" : "&store_id=\(storeID)"); if let value = try? await APIClient.shared.json("operations/workspace?\(query)") { data = value } }
    private func alertIcon(_ kind: String) -> String { ["coverage": "person.2", "tasks": "checklist", "timecards": "clock", "cases": "bubble.left"][kind] ?? "exclamationmark.triangle" }
    private func operationsTool(_ title: String, _ subtitle: String, _ icon: String) -> some View { PlatformCard { HStack(spacing: 13) { Image(systemName: icon).font(.title3).foregroundStyle(AppColor.green).frame(width: 44, height: 44).background(AppColor.greenTint).clipShape(RoundedRectangle(cornerRadius: 12)); VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline).foregroundStyle(AppColor.text); Text(subtitle).font(.caption).foregroundStyle(AppColor.muted) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } } }
}

struct OperationsManagementView: View {
    var body: some View {
        PlatformScreen("Управление точками", subtitle: "Все операционные действия в одном разделе") {
            ManagerToolsView()
        }
        .navigationTitle("Управление").platformNavigationStyle()
    }
}

private func initials(_ name: String) -> String { name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased() }
private func courseTitle(_ id: String) -> String { ["service-standards": "Стандарты сервиса Bahandi", "kitchen-safety": "Безопасность на кухне", "shift-lead": "Основы управления сменой"][id] ?? id }
