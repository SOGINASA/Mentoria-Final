import SwiftUI

struct PlatformTodayView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    @State private var showWriteOff = false

    var body: some View {
        Group {
            if platform.isLoading && platform.permissions.isEmpty { PlatformLoadingView() }
            else if let error = platform.errorMessage, platform.permissions.isEmpty {
                PlatformErrorView(message: error) { Task { await platform.refresh(role: auth.role) } }
            } else {
                PlatformScreen("Добрый день, \(auth.user?.fullName.split(separator: " ").first.map(String.init) ?? "")", subtitle: "Всё важное для рабочего дня") {
                    if platform.feature("shifts") || platform.feature("time_tracking") { shiftCard }
                    if platform.feature("income") { incomeCard }
                    quickActions
                    if platform.feature("tasks") && platform.hasPermission("tasks.read_own") { taskPreview }
                    newsPreview
                }
                .accessibilityIdentifier("platform.today.ready")
                .refreshable { await platform.refresh(role: auth.role) }
            }
        }
        .fullScreenCover(isPresented: $showWriteOff) { NavigationStack { CreateWriteOffView() } }
        .navigationTitle("Сегодня").platformNavigationStyle()
    }

    private var shiftCard: some View {
        let shift = platform.shifts.first
        return PlatformCard(tint: AppColor.green) {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("СЕГОДНЯШНЯЯ СМЕНА").font(.caption.bold()).foregroundStyle(.white.opacity(0.72))
                        Text(shift.map(shiftRange) ?? "Смена не назначена").font(.title.bold()).foregroundStyle(.white)
                    }
                    Spacer()
                    Text(platform.shiftActive ? "Идёт" : shift == nil ? "Вне графика" : "Опубликована")
                        .font(.caption.bold()).padding(.horizontal, 10).padding(.vertical, 6)
                        .background(.white.opacity(0.14)).clipShape(Capsule()).foregroundStyle(.white)
                }
                HStack(spacing: 10) {
                    Image(systemName: "mappin.and.ellipse")
                    Text(shift?.store?.name ?? auth.user?.store?.name ?? "Торговая точка не указана").lineLimit(2)
                }.font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.9))
                if shift == nil {
                    Text("Начать работу можно вне расписания: отметка привяжется к основной торговой точке.")
                        .font(.caption).foregroundStyle(.white.opacity(0.7))
                }
                if platform.hasPermission("time.track_own") &&
                    (platform.allowedTimeActions.contains("clock_in") || platform.allowedTimeActions.contains("clock_out")) {
                    PlatformPrimaryButton(title: platform.shiftActive ? "Завершить смену" : "Начать смену",
                                          icon: platform.shiftActive ? "stop.fill" : "play.fill",
                                          loading: platform.isMutating,
                                          disabled: auth.user?.storeId == nil && !platform.shiftActive) {
                        Task {
                            do { try await platform.toggleShift(); settings.showToast(platform.shiftActive ? "Смена начата" : "Смена завершена") }
                            catch { settings.showToast(error.localizedDescription) }
                        }
                    }
                }
                if platform.hasPermission("time.track_own") && platform.allowedTimeActions.contains("break_start") {
                    Button { Task { do { try await platform.performTimeAction("break_start"); settings.showToast("Перерыв начат") } catch { settings.showToast(error.localizedDescription) } } } label: {
                        Label("Начать перерыв", systemImage: "cup.and.saucer").frame(maxWidth: .infinity, minHeight: 48)
                    }.buttonStyle(.bordered).tint(.white).foregroundStyle(.white).disabled(platform.isMutating)
                } else if platform.hasPermission("time.track_own") && platform.allowedTimeActions.contains("break_end") {
                    PlatformPrimaryButton(title: "Вернуться с перерыва", icon: "arrow.uturn.forward", loading: platform.isMutating) {
                        Task { do { try await platform.performTimeAction("break_end"); settings.showToast("Работа продолжена") } catch { settings.showToast(error.localizedDescription) } }
                    }
                }
            }
        }
    }

    private var incomeCard: some View {
        let minutes = platform.timecards.filter { ["approved", "corrected"].contains($0.status) }.reduce(0) { $0 + $1.workedMinutes }
        return PlatformCard {
            HStack { VStack(alignment: .leading, spacing: 5) { Text("Подтверждено часов").font(.caption).foregroundStyle(AppColor.muted); Text("\(minutes / 60) ч \(minutes % 60) мин").font(.title2.bold()).monospacedDigit() }; Spacer(); Image(systemName: "wallet.pass").font(.title2).foregroundStyle(AppColor.green) }
        }
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            PlatformSectionTitle(title: "Быстрые действия")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                if platform.feature("shifts") {
                    NavigationLink { PlatformShiftsView() } label: { actionLabel("График", "calendar", AppColor.green) }.buttonStyle(.plain)
                }
                if platform.feature("hr_services") {
                    NavigationLink { EmployeeServicesView() } label: { actionLabel("Сервисы", "square.grid.2x2", AppColor.orange) }.buttonStyle(.plain)
                }
                if auth.role == Role.sender {
                    action("Списание", "camera", AppColor.orange) { showWriteOff = true }
                }
                if platform.feature("support_cases") {
                    NavigationLink { PlatformSupportView() } label: { actionLabel("Помощь", "questionmark.circle", AppColor.green) }.buttonStyle(.plain)
                }
            }
        }
    }

    private var taskPreview: some View {
        VStack(alignment: .leading, spacing: 12) {
            PlatformSectionTitle(title: "В фокусе")
            if platform.pendingTasks.isEmpty { PlatformCard { Label("Активных задач пока нет", systemImage: "checkmark.circle").foregroundStyle(AppColor.muted) } }
            else { ForEach(platform.pendingTasks.prefix(3)) { task in NavigationLink { PlatformTaskDetailView(taskId: task.id) } label: { taskRow(task) }.buttonStyle(.plain) } }
        }
    }

    private var newsPreview: some View {
        Group {
            if platform.feature("news") && !platform.news.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    PlatformSectionTitle(title: "Новости команды", action: nil)
                    ForEach(platform.news.prefix(2)) { item in NavigationLink { PlatformNewsDetailView(item: item) } label: { PlatformCard { HStack { Image(systemName: item.isRead ? "newspaper" : "bell.badge.fill").foregroundStyle(item.isRead ? AppColor.muted : AppColor.orange); VStack(alignment: .leading) { Text(item.title).font(.headline).foregroundStyle(AppColor.text); if let excerpt = item.excerpt { Text(excerpt).font(.caption).foregroundStyle(AppColor.muted).lineLimit(2) } }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } } }.buttonStyle(.plain) }
                    NavigationLink { PlatformNewsListView() } label: {
                        Label("Все новости", systemImage: "newspaper").frame(maxWidth: .infinity, minHeight: 44)
                    }.buttonStyle(.bordered).tint(AppColor.green)
                }
            }
        }
    }

    private func action(_ title: String, _ icon: String, _ color: Color, action: @escaping () -> Void) -> some View { Button(action: action) { actionLabel(title, icon, color) }.buttonStyle(.plain) }
    private func actionLabel(_ title: String, _ icon: String, _ color: Color) -> some View { PlatformCard { VStack(alignment: .leading, spacing: 12) { Image(systemName: icon).font(.title2).foregroundStyle(color); Text(title).font(.headline).foregroundStyle(AppColor.text) } }.frame(maxWidth: .infinity) }
    private func taskRow(_ task: PlatformTask) -> some View { PlatformCard { HStack { Image(systemName: task.taskType == "learning" ? "book" : "checklist").foregroundStyle(AppColor.green); VStack(alignment: .leading, spacing: 4) { Text(task.title).font(.headline).foregroundStyle(AppColor.text); if let due = task.dueAt { Text(dateLabel(due, lang: settings.lang)).font(.caption).foregroundStyle(AppColor.muted) } }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } } }
    private func shiftRange(_ shift: PlatformShift) -> String { guard let start = parseDate(shift.startsAt), let end = parseDate(shift.endsAt) else { return shift.title }; return "\(start.formatted(date: .omitted, time: .shortened))–\(end.formatted(date: .omitted, time: .shortened))" }
}

struct PlatformShiftsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    @State private var requestTarget: PlatformShift?
    @State private var requestComment = ""
    var body: some View {
        PlatformScreen("Мой график", subtitle: "Назначенные и открытые смены") {
            PlatformSectionTitle(title: "Ближайшие смены")
            if platform.shifts.isEmpty { PlatformCard { Text("Назначенных смен пока нет").foregroundStyle(AppColor.muted) } }
            ForEach(platform.shifts) { shift in shiftRow(shift, open: false) }
            if !platform.shiftRequests.isEmpty {
                PlatformSectionTitle(title: "Мои запросы")
                ForEach(platform.shiftRequests) { item in PlatformCard { HStack { Image(systemName: item.status == "pending" ? "clock" : item.status == "approved" ? "checkmark.circle.fill" : "xmark.circle.fill").foregroundStyle(item.status == "pending" ? AppColor.orange : item.status == "approved" ? AppColor.green : AppColor.red); VStack(alignment: .leading, spacing: 4) { Text(requestTypeTitle(item.requestType)).font(.headline); Text("#\(item.id) · \(statusTitle(item.status))").font(.caption).foregroundStyle(AppColor.muted) }; Spacer() } } }
            }
            PlatformSectionTitle(title: "Открытые смены")
            if platform.openShifts.isEmpty { PlatformCard { Text("Доступных смен сейчас нет").foregroundStyle(AppColor.muted) } }
            ForEach(platform.openShifts) { shift in shiftRow(shift, open: true) }
        }
        .sheet(item: $requestTarget) { shift in
            NavigationStack { Form { Section("Смена") { Text(shift.title); Text(dateLabel(shift.startsAt, lang: settings.lang)).foregroundStyle(AppColor.muted) }; Section("Комментарий") { TextField("Почему вы не можете выйти?", text: $requestComment, axis: .vertical).lineLimit(3...6) } }.navigationTitle("Освободить смену").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Отмена") { requestTarget = nil } }; ToolbarItem(placement: .confirmationAction) { Button("Отправить") { Task { do { try await platform.requestShiftChange(shift, type: "release", comment: requestComment); settings.showToast("Запрос отправлен"); requestTarget = nil; requestComment = "" } catch { settings.showToast(error.localizedDescription) } } }.disabled(platform.isMutating) } } }
        }
        .refreshable { await platform.refresh(role: auth.role) }.navigationTitle("Смены").platformNavigationStyle()
    }
    private func shiftRow(_ shift: PlatformShift, open: Bool) -> some View {
        PlatformCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack { Image(systemName: "calendar").foregroundStyle(AppColor.green); Text(shift.title).font(.headline); Spacer(); Text(shift.status).font(.caption).foregroundStyle(AppColor.muted) }
                Text("\(dateLabel(shift.startsAt, lang: settings.lang)) · \(shift.store?.name ?? "Точка")").font(.subheadline).foregroundStyle(AppColor.muted)
                if open { Button("Запросить смену") { Task { do { try await platform.requestOpenShift(shift); settings.showToast("Запрос отправлен") } catch { settings.showToast(error.localizedDescription) } } }.buttonStyle(.borderedProminent).tint(AppColor.green).disabled(platform.isMutating) }
                else if !platform.shiftRequests.contains(where: { $0.shiftId == shift.id && $0.status == "pending" }) {
                    Button("Попросить снять со смены", role: .destructive) { requestTarget = shift }.frame(minHeight: 44)
                }
            }
        }
    }
    private func requestTypeTitle(_ type: String) -> String { ["open_shift": "Запрос открытой смены", "release": "Освобождение смены", "swap": "Обмен сменами"][type] ?? type }
}

struct PlatformTasksView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore
    @State private var showCompleted = false
    var body: some View {
        PlatformScreen("Мои задачи", subtitle: "Поручения, чек-листы и обучение") {
            Picker("Статус", selection: $showCompleted) { Text("Активные").tag(false); Text("Выполненные").tag(true) }.pickerStyle(.segmented)
            let items = platform.tasks.filter { $0.done == showCompleted }
            if items.isEmpty { PlatformCard { Text(showCompleted ? "Выполненных задач пока нет" : "Активных задач пока нет").foregroundStyle(AppColor.muted) } }
            ForEach(items) { task in NavigationLink { PlatformTaskDetailView(taskId: task.id) } label: { PlatformCard { HStack { Image(systemName: task.done ? "checkmark.circle.fill" : "circle").foregroundStyle(task.done ? AppColor.green : AppColor.faint); VStack(alignment: .leading, spacing: 5) { Text(task.title).font(.headline).foregroundStyle(AppColor.text); if let progress = task.progress { ProgressView(value: Double(progress), total: 100).tint(AppColor.green) } }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint) } } }.buttonStyle(.plain) }
        }.refreshable { await platform.refresh(role: auth.role) }.navigationTitle("Задачи").platformNavigationStyle()
    }
}

struct PlatformTaskDetailView: View {
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    let taskId: Int
    private var task: PlatformTask? { platform.tasks.first { $0.id == taskId } }
    var body: some View {
        PlatformScreen(task?.title ?? "Задача", subtitle: task?.description) {
            if let task {
                ForEach(task.steps) { step in Button { Task { do { try await platform.toggleStep(task: task, step: step) } catch { settings.showToast(error.localizedDescription) } } } label: { PlatformCard { HStack { Image(systemName: step.done ? "checkmark.circle.fill" : "circle").foregroundStyle(step.done ? AppColor.green : AppColor.faint); Text(step.title).foregroundStyle(AppColor.text); Spacer() } } }.buttonStyle(.plain).disabled(platform.isMutating) }
                PlatformPrimaryButton(title: task.done ? "Вернуть в работу" : "Завершить задачу", icon: task.done ? "arrow.uturn.backward" : "checkmark", loading: platform.isMutating) { Task { do { try await platform.setTaskDone(task, done: !task.done); settings.showToast("Задача обновлена") } catch { settings.showToast(error.localizedDescription) } } }
            }
        }.navigationTitle("Задача").platformNavigationStyle()
    }
}

struct PlatformNewsDetailView: View {
    @EnvironmentObject private var platform: PlatformStore
    let item: NewsRecord
    var body: some View { PlatformScreen(item.title, subtitle: item.category) { PlatformCard { Text(item.body).font(.body).foregroundStyle(AppColor.text) } }.task { await platform.markNewsRead(item) }.navigationTitle("Новость").platformNavigationStyle() }
}

struct PlatformNewsListView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore

    var body: some View {
        PlatformScreen("Новости команды", subtitle: "Изменения процессов, обучение и важное из жизни Bahandi") {
            if platform.news.isEmpty {
                ContentUnavailableView("Новостей пока нет", systemImage: "newspaper",
                                       description: Text("Новые публикации появятся здесь."))
                    .frame(maxWidth: .infinity, minHeight: 280)
            }
            ForEach(platform.news) { item in
                NavigationLink { PlatformNewsDetailView(item: item) } label: {
                    PlatformCard {
                        HStack(alignment: .top, spacing: 13) {
                            Image(systemName: item.isRead ? "newspaper" : "bell.badge.fill")
                                .font(.title3).foregroundStyle(item.isRead ? AppColor.muted : AppColor.green)
                                .frame(width: 44, height: 44).background(item.isRead ? AppColor.surface2 : AppColor.greenTint)
                                .clipShape(RoundedRectangle(cornerRadius: 13))
                            VStack(alignment: .leading, spacing: 6) {
                                HStack { Text(item.category ?? "Новости").font(.caption.bold()).foregroundStyle(AppColor.green); if !item.isRead { Text("НОВОЕ").font(.caption2.bold()).foregroundStyle(AppColor.orange) } }
                                Text(item.title).font(.headline).foregroundStyle(AppColor.text)
                                if let excerpt = item.excerpt { Text(excerpt).font(.subheadline).foregroundStyle(AppColor.muted).lineLimit(3) }
                            }
                            Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint)
                        }
                    }
                }.buttonStyle(.plain)
            }
        }
        .refreshable { await platform.refresh(role: auth.role) }
        .navigationTitle("Новости").platformNavigationStyle()
    }
}
