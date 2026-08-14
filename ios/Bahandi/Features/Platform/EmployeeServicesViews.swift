import SwiftUI

private struct ServiceDestination: Identifiable {
    let id: String; let title: String; let subtitle: String; let icon: String; let color: Color
}

private let serviceDestinations = [
    ServiceDestination(id: "learning", title: "Обучение и допуски", subtitle: "Обязательные курсы и прогресс", icon: "book.closed", color: AppColor.green),
    ServiceDestination(id: "documents", title: "Мои документы", subtitle: "Справки и кадровые документы", icon: "doc.text", color: AppColor.orange),
    ServiceDestination(id: "leave", title: "Отпуск и отсутствие", subtitle: "Баланс, заявки и статусы", icon: "calendar", color: AppColor.amber),
    ServiceDestination(id: "support", title: "Помощь и обращения", subtitle: "HR, payroll и операционные вопросы", icon: "questionmark.bubble", color: AppColor.green),
    ServiceDestination(id: "income", title: "Доход", subtitle: "Подтверждённые часы и табели", icon: "banknote", color: AppColor.orange),
    ServiceDestination(id: "news", title: "Новости команды", subtitle: "Важные изменения и объявления", icon: "newspaper", color: AppColor.green),
    ServiceDestination(id: "tasks", title: "Мои задачи", subtitle: "Поручения и рабочие чек-листы", icon: "checklist", color: AppColor.orange),
]

struct EmployeeServicesView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore
    var body: some View {
        PlatformScreen("Сервисы сотрудника", subtitle: "Рабочие и кадровые процессы в одном месте") {
            HStack(spacing: 10) {
                MetricTile(icon: "book", value: "\(platform.learning.filter(\.assessmentPassed).count)", label: "курсов пройдено")
                MetricTile(icon: "calendar", value: "\(platform.leaveBalance?.availableDays ?? 0)", label: "дней отпуска", tone: AppColor.orange)
            }
            PlatformSectionTitle(title: "Все сервисы")
            ForEach(availableServices) { service in destination(service) }
        }
        .refreshable { await platform.refresh(role: auth.role) }.navigationTitle("Сервисы").platformNavigationStyle()
    }
    @ViewBuilder private func destination(_ item: ServiceDestination) -> some View {
        let label = PlatformCard { HStack(spacing: 14) { Image(systemName: item.icon).font(.title2).frame(width: 44, height: 44).background(item.color.opacity(0.12)).clipShape(RoundedRectangle(cornerRadius: 13)).foregroundStyle(item.color); VStack(alignment: .leading, spacing: 4) { Text(item.title).font(.headline).foregroundStyle(AppColor.text); Text(item.subtitle).font(.caption).foregroundStyle(AppColor.muted) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } }
        switch item.id {
        case "learning": NavigationLink { PlatformLearningView() } label: { label }.buttonStyle(.plain).accessibilityIdentifier("service.learning")
        case "documents": NavigationLink { PlatformDocumentsView() } label: { label }.buttonStyle(.plain).accessibilityIdentifier("service.documents")
        case "leave": NavigationLink { PlatformLeaveView() } label: { label }.buttonStyle(.plain).accessibilityIdentifier("service.leave")
        case "support": NavigationLink { PlatformSupportView() } label: { label }.buttonStyle(.plain).accessibilityIdentifier("service.support")
        case "news": NavigationLink { PlatformNewsListView() } label: { label }.buttonStyle(.plain).accessibilityIdentifier("service.news")
        case "tasks": NavigationLink { PlatformTasksView() } label: { label }.buttonStyle(.plain).accessibilityIdentifier("service.tasks")
        default: NavigationLink { PlatformIncomeView() } label: { label }.buttonStyle(.plain).accessibilityIdentifier("service.income")
        }
    }

    private var availableServices: [ServiceDestination] {
        serviceDestinations.filter { item in
            switch item.id {
            case "learning", "documents", "leave": return platform.feature("hr_services")
            case "support": return platform.feature("support_cases")
            case "income": return platform.feature("income")
            case "news": return platform.feature("news")
            case "tasks": return platform.feature("tasks") && platform.hasPermission("tasks.read_own")
            default: return true
            }
        }
    }
}

struct CourseDefinition: Identifiable {
    let id: String
    let title: String
    let description: String
    let modules: [CourseModule]
    let assessment: CourseAssessment
}

struct CourseModule: Identifiable {
    let id: String
    let title: String
    let duration: String
    let body: String
}

struct CourseAssessment {
    let question: String
    let options: [(id: String, title: String)]
}

private let courses = [
    CourseDefinition(
        id: "service-standards", title: "Стандарты сервиса Bahandi",
        description: "Полный путь гостя: от приветствия до выдачи заказа и обратной связи.",
        modules: [
            CourseModule(id: "welcome", title: "Первый контакт с гостем", duration: "5 мин", body: "Приветствуйте гостя в течение первых секунд, сохраняйте зрительный контакт и помогайте с выбором без давления."),
            CourseModule(id: "order", title: "Приём и уточнение заказа", duration: "7 мин", body: "Повторите состав заказа, уточните важные детали и заранее сообщите реалистичное время ожидания."),
            CourseModule(id: "handoff", title: "Выдача и завершение визита", duration: "6 мин", body: "Проверьте комплектность, назовите заказ и убедитесь, что гостю не требуется дополнительная помощь."),
            CourseModule(id: "feedback", title: "Работа с обратной связью", duration: "8 мин", body: "Сначала выслушайте гостя, подтвердите, что поняли ситуацию, и предложите понятный следующий шаг."),
        ],
        assessment: CourseAssessment(question: "Что нужно сделать перед завершением выдачи заказа?", options: [
            ("a", "Проверить комплектность и убедиться, что гостю ничего не требуется"),
            ("b", "Сразу перейти к следующему заказу"),
            ("c", "Попросить гостя самостоятельно сверить заказ"),
        ])
    ),
    CourseDefinition(
        id: "kitchen-safety", title: "Безопасность на кухне",
        description: "Температурные режимы, личная безопасность и действия в нештатных ситуациях.",
        modules: [
            CourseModule(id: "temperature", title: "Температурные режимы", duration: "8 мин", body: "Сверяйте показатели с технологической картой и сразу фиксируйте отклонения в журнале контроля."),
            CourseModule(id: "equipment", title: "Работа с оборудованием", duration: "9 мин", body: "Перед началом смены проверьте исправность оборудования и защитных элементов. Не используйте технику с признаками повреждения."),
            CourseModule(id: "incident", title: "Действия при инциденте", duration: "6 мин", body: "Остановите опасную операцию, предупредите коллег и немедленно сообщите менеджеру смены."),
        ],
        assessment: CourseAssessment(question: "Как действовать при признаках неисправности оборудования?", options: [
            ("a", "Продолжить работу до конца смены"),
            ("b", "Остановить работу и сообщить менеджеру смены"),
            ("c", "Попытаться отремонтировать оборудование самостоятельно"),
        ])
    ),
    CourseDefinition(
        id: "shift-lead", title: "Основы управления сменой",
        description: "Распределение ролей, контроль темпа и качественная передача смены.",
        modules: [
            CourseModule(id: "briefing", title: "Брифинг команды", duration: "7 мин", body: "Обозначьте цель смены, распределите зоны ответственности и убедитесь, что каждый понимает свою роль."),
            CourseModule(id: "peak", title: "Управление в часы пик", duration: "10 мин", body: "Следите за узкими местами процесса и перераспределяйте помощь до того, как очередь начнёт расти."),
            CourseModule(id: "handover", title: "Передача смены", duration: "6 мин", body: "Зафиксируйте остатки, состояние оборудования и незакрытые вопросы для следующей команды."),
        ],
        assessment: CourseAssessment(question: "Что важно сделать на брифинге перед сменой?", options: [
            ("a", "Обозначить цель и распределить зоны ответственности"),
            ("b", "Обсудить только результаты прошлой недели"),
            ("c", "Оставить распределение ролей на усмотрение команды"),
        ])
    ),
]

struct PlatformLearningView: View {
    @EnvironmentObject private var platform: PlatformStore
    var body: some View {
        PlatformScreen("Обучение и допуски", subtitle: "Прогресс синхронизируется с платформой") {
            ForEach(courses) { course in
                let progress = platform.learning.first { $0.courseId == course.id }
                NavigationLink { PlatformCourseView(course: course) } label: {
                    PlatformCard { HStack { Image(systemName: progress?.assessmentPassed == true ? "checkmark.seal.fill" : "book.closed").font(.title2).foregroundStyle(progress?.assessmentPassed == true ? AppColor.green : AppColor.orange); VStack(alignment: .leading, spacing: 6) { Text(course.title).font(.headline).foregroundStyle(AppColor.text); Text("\(progress?.completedModuleIds.count ?? 0) из \(course.modules.count) модулей").font(.caption).foregroundStyle(AppColor.muted); ProgressView(value: Double(progress?.completedModuleIds.count ?? 0), total: Double(course.modules.count)).tint(AppColor.green) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } }
                }.buttonStyle(.plain)
            }
        }.navigationTitle("Обучение").platformNavigationStyle()
    }
}

struct PlatformCourseView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    let course: CourseDefinition
    @State private var assessmentOpen = false
    @State private var selectedAnswer = ""
    @State private var assessmentError: String?
    @State private var submittingAssessment = false
    private var progress: LearningProgressRecord? { platform.learning.first { $0.courseId == course.id } }
    var body: some View {
        PlatformScreen(course.title, subtitle: course.description) {
            ForEach(Array(course.modules.enumerated()), id: \.offset) { index, module in
                let done = progress?.completedModuleIds.contains(module.id) == true
                PlatformCard {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: done ? "checkmark.circle.fill" : "\(index + 1).circle")
                                .font(.title3).foregroundStyle(done ? AppColor.green : AppColor.faint)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(module.title).font(.headline).foregroundStyle(AppColor.text)
                                Text(module.duration).font(.caption).foregroundStyle(AppColor.muted)
                            }
                        }
                        Text(module.body).font(.subheadline).foregroundStyle(AppColor.muted)
                        if !done {
                            Button("Завершить урок") {
                                Task { await complete(module) }
                            }
                            .buttonStyle(.borderedProminent).tint(AppColor.green)
                            .frame(minHeight: 44).disabled(platform.isMutating)
                        }
                    }
                }
            }
            if progress?.completedModuleIds.count == course.modules.count && progress?.assessmentPassed != true {
                PlatformPrimaryButton(title: "Пройти проверку", icon: "checkmark.seal") { assessmentOpen = true }
            }
            if progress?.assessmentPassed == true {
                PlatformCard(tint: AppColor.greenTint) {
                    Label("Курс завершён, допуск подтверждён", systemImage: "checkmark.seal.fill")
                        .font(.headline).foregroundStyle(AppColor.green)
                }
            }
        }
        .sheet(isPresented: $assessmentOpen) { assessmentSheet }
        .navigationTitle("Курс").platformNavigationStyle()
    }

    private var assessmentSheet: some View {
        NavigationStack {
            Form {
                Section(course.assessment.question) {
                    ForEach(Array(course.assessment.options.enumerated()), id: \.offset) { _, option in
                        Button {
                            selectedAnswer = option.id
                            assessmentError = nil
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: selectedAnswer == option.id ? "largecircle.fill.circle" : "circle")
                                    .foregroundStyle(selectedAnswer == option.id ? AppColor.green : AppColor.faint)
                                Text(option.title).foregroundStyle(AppColor.text)
                            }.frame(minHeight: 44)
                        }
                    }
                }
                if let assessmentError { Section { Text(assessmentError).foregroundStyle(AppColor.red) } }
            }
            .navigationTitle("Проверка знаний").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("К уроку") { assessmentOpen = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(submittingAssessment ? "Проверяем…" : "Проверить") { Task { await submitAssessment() } }
                        .disabled(selectedAnswer.isEmpty || submittingAssessment)
                }
            }
        }
    }

    private func complete(_ module: CourseModule) async {
        do {
            _ = try await APIClient.shared.completeLearningModule(courseId: course.id, moduleId: module.id)
            await platform.refresh(role: auth.role)
            settings.showToast("Урок завершён")
        } catch { settings.showToast(error.localizedDescription) }
    }

    private func submitAssessment() async {
        submittingAssessment = true; defer { submittingAssessment = false }
        do {
            let response = try await APIClient.shared.completeAssessment(courseId: course.id, answer: selectedAnswer)
            await platform.refresh(role: auth.role)
            if response.progress.assessmentPassed {
                assessmentOpen = false
                settings.showToast("Проверка пройдена — курс завершён")
            } else {
                assessmentError = "Ответ неверный. Вернитесь к материалу и попробуйте ещё раз."
            }
        } catch { assessmentError = error.localizedDescription }
    }
}

struct PlatformDocumentsView: View {
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    private let catalog = [("contract", "Трудовой договор"), ("payslip", "Расчётный лист"), ("employment", "Справка с места работы"), ("income", "Справка о доходах")]
    var body: some View {
        PlatformScreen("Мои документы", subtitle: "Запросы обрабатываются кадровой системой") {
            PlatformSectionTitle(title: "Доступные документы")
            ForEach(catalog, id: \.0) { item in
                PlatformCard { HStack { Image(systemName: "doc.text").font(.title2).foregroundStyle(AppColor.green); VStack(alignment: .leading) { Text(item.1).font(.headline); if let request = platform.documents.first(where: { $0.documentId == item.0 }) { Text("\(request.reference) · \(request.status)").font(.caption).foregroundStyle(AppColor.muted) } }; Spacer(); Button { Task { do { try await platform.requestDocument(item.0); settings.showToast("Запрос создан") } catch { settings.showToast(error.localizedDescription) } } } label: { Image(systemName: "paperplane").frame(width: 44, height: 44) }.buttonStyle(.bordered).tint(AppColor.green).disabled(platform.isMutating) } }
            }
        }.navigationTitle("Документы").platformNavigationStyle()
    }
}

struct PlatformLeaveView: View {
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    @State private var showingForm = false
    @State private var cancelTarget: LeaveRequestRecord?
    var body: some View {
        PlatformScreen("Отпуск и отсутствие", subtitle: "Баланс и история заявок") {
            HStack(spacing: 10) { MetricTile(icon: "calendar", value: "\(platform.leaveBalance?.availableDays ?? 0)", label: "дней доступно"); MetricTile(icon: "clock", value: "\(platform.leaveRequests.filter { $0.status == "pending" }.count)", label: "на согласовании", tone: AppColor.orange) }
            PlatformPrimaryButton(title: "Новая заявка", icon: "plus") { showingForm = true }
            PlatformSectionTitle(title: "История")
            if platform.leaveRequests.isEmpty { PlatformCard { Text("Заявок пока нет").foregroundStyle(AppColor.muted) } }
            ForEach(platform.leaveRequests) { item in PlatformCard { VStack(alignment: .leading, spacing: 8) { HStack { Text(leaveTitle(item.leaveType)).font(.headline); Spacer(); Text(item.status).font(.caption.bold()).foregroundStyle(item.status == "approved" ? AppColor.green : item.status == "rejected" ? AppColor.red : AppColor.orange) }; Text("\(item.startsOn) — \(item.endsOn) · \(item.days) дн.").font(.subheadline).foregroundStyle(AppColor.muted); if item.status == "pending" { Button("Отменить заявку", role: .destructive) { cancelTarget = item }.frame(minHeight: 44) } } } }
        }
        .sheet(isPresented: $showingForm) { LeaveRequestForm() }
        .confirmationDialog("Отменить заявку?", isPresented: Binding(get: { cancelTarget != nil }, set: { if !$0 { cancelTarget = nil } })) { Button("Отменить заявку", role: .destructive) { guard let item = cancelTarget else { return }; Task { do { try await platform.cancelLeave(item); cancelTarget = nil; settings.showToast("Заявка отменена") } catch { settings.showToast(error.localizedDescription) } } }; Button("Оставить", role: .cancel) { cancelTarget = nil } }
        .navigationTitle("Отпуск").platformNavigationStyle()
    }
    private func leaveTitle(_ value: String) -> String { ["annual":"Ежегодный отпуск", "unpaid":"Без сохранения зарплаты", "sick":"Больничный", "other":"Другое отсутствие"][value] ?? value }
}

private struct LeaveRequestForm: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    @State private var type = "annual"; @State private var start = Date(); @State private var end = Date(); @State private var comment = ""
    var body: some View {
        NavigationStack {
            Form {
                Picker("Тип отсутствия", selection: $type) { Text("Ежегодный отпуск").tag("annual"); Text("Без сохранения зарплаты").tag("unpaid"); Text("Больничный").tag("sick"); Text("Другое").tag("other") }
                DatePicker("Начало", selection: $start, in: Date()..., displayedComponents: .date)
                DatePicker("Окончание", selection: $end, in: start..., displayedComponents: .date)
                TextField("Комментарий", text: $comment, axis: .vertical).lineLimit(3...6)
            }
            .navigationTitle("Новая заявка").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Отмена") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Отправить") { Task { do { try await platform.requestLeave(type: type, start: start, end: end, comment: comment); settings.showToast("Заявка отправлена"); dismiss() } catch { settings.showToast(error.localizedDescription) } } }.disabled(platform.isMutating) } }
        }
    }
}

struct PlatformIncomeView: View {
    @EnvironmentObject private var platform: PlatformStore
    var body: some View {
        let confirmed = platform.timecards.filter { ["approved", "corrected"].contains($0.status) }.reduce(0) { $0 + $1.workedMinutes }
        let pending = platform.timecards.filter { $0.status == "submitted" }.reduce(0) { $0 + $1.workedMinutes }
        PlatformScreen("Мой доход", subtitle: "Данные по рабочему времени") {
            MetricTile(icon: "checkmark.circle", value: "\(confirmed / 60) ч \(confirmed % 60) мин", label: "подтверждено")
            MetricTile(icon: "clock", value: "\(pending / 60) ч \(pending % 60) мин", label: "на проверке", tone: AppColor.orange)
            PlatformCard(tint: AppColor.orangeTint) { Label("Денежный расчёт появится после подключения официального источника ставок и payroll.", systemImage: "info.circle").font(.subheadline).foregroundStyle(AppColor.text) }
            PlatformSectionTitle(title: "Табели")
            if platform.timecards.isEmpty { PlatformCard { Text("Табелей пока нет").foregroundStyle(AppColor.muted) } }
            ForEach(platform.timecards) { card in
                NavigationLink { PlatformTimecardDetailView(card: card) } label: {
                    PlatformCard { HStack { Image(systemName: card.status == "approved" || card.status == "corrected" ? "checkmark.circle.fill" : "clock").foregroundStyle(card.status == "approved" || card.status == "corrected" ? AppColor.green : AppColor.orange); VStack(alignment: .leading, spacing: 4) { Text(dateLabel(card.clockInAt, lang: "ru")).font(.headline).foregroundStyle(AppColor.text); Text("\(card.workedMinutes / 60) ч \(card.workedMinutes % 60) мин · \(statusTitle(card.status))").font(.caption).foregroundStyle(AppColor.muted) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } }
                }.buttonStyle(.plain)
            }
        }.navigationTitle("Доход").platformNavigationStyle()
    }
}
