import SwiftUI

struct PlatformNotificationsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore
    @State private var unreadOnly = false

    private var items: [PlatformNotification] {
        unreadOnly ? platform.notifications.filter { !$0.isRead } : platform.notifications
    }

    var body: some View {
        PlatformScreen("Уведомления", subtitle: "Изменения по рабочим процессам") {
            HStack {
                Picker("Фильтр", selection: $unreadOnly) { Text("Все").tag(false); Text("Новые \(platform.unreadNotifications)").tag(true) }.pickerStyle(.segmented)
                if platform.unreadNotifications > 0 { Button("Прочитать всё") { Task { await platform.markAllNotificationsRead() } }.font(.caption.bold()).frame(minHeight: 44) }
            }
            if items.isEmpty {
                ContentUnavailableView(unreadOnly ? "Новых уведомлений нет" : "Уведомлений пока нет", systemImage: "bell",
                                       description: Text("Изменения по сменам, задачам и обращениям появятся здесь."))
                    .frame(maxWidth: .infinity, minHeight: 280)
            }
            ForEach(items) { item in
                NavigationLink { destination(item) } label: {
                    PlatformCard {
                        HStack(alignment: .top, spacing: 13) {
                            Image(systemName: notificationIcon(item)).font(.title3)
                                .foregroundStyle(item.isRead ? AppColor.muted : AppColor.green)
                                .frame(width: 42, height: 42).background(item.isRead ? AppColor.surface2 : AppColor.greenTint)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            VStack(alignment: .leading, spacing: 5) {
                                HStack { Text(item.title).font(.headline).foregroundStyle(AppColor.text); if !item.isRead { Text("НОВОЕ").font(.caption2.bold()).foregroundStyle(AppColor.orange) } }
                                if let body = item.body { Text(body).font(.subheadline).foregroundStyle(AppColor.muted).lineLimit(3) }
                                if let created = item.createdAt { Text(dateLabel(created, lang: "ru")).font(.caption).foregroundStyle(AppColor.faint) }
                            }
                            Spacer(); Image(systemName: "chevron.right").foregroundStyle(AppColor.faint)
                        }
                    }
                }.buttonStyle(.plain).simultaneousGesture(TapGesture().onEnded { Task { await platform.markNotificationRead(item) } })
            }
        }
        .refreshable { await platform.refresh(role: auth.role) }
        .navigationTitle("Уведомления").platformNavigationStyle()
    }

    @ViewBuilder private func destination(_ item: PlatformNotification) -> some View {
        if let id = item.writeOffId { auth.role == Role.sender ? AnyView(RequestDetailView(id: id)) : AnyView(ReviewDetailView(id: id)) }
        else if item.entityType == "support_case" { PlatformSupportView() }
        else if item.entityType == "task" { PlatformTasksView() }
        else if item.entityType == "shift" || item.entityType == "shift_request" { PlatformShiftsView() }
        else if item.entityType == "timecard" || item.entityType == "time_correction" { PlatformIncomeView() }
        else { PlatformTodayView() }
    }

    private func notificationIcon(_ item: PlatformNotification) -> String {
        switch item.entityType { case "shift", "shift_request": return "calendar"; case "task": return "checklist"; case "support_case": return "bubble.left"; case "timecard", "time_correction": return "clock"; default: return item.writeOffId == nil ? "bell" : "camera" }
    }
}

struct PlatformTimecardDetailView: View {
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    let card: PlatformTimecard
    @State private var showCorrection = false

    var body: some View {
        PlatformScreen("Табель", subtitle: "#\(card.id) · \(statusTitle(card.status))") {
            PlatformCard {
                VStack(spacing: 13) {
                    LabeledContent("Начало", value: dateLabel(card.clockInAt, lang: settings.lang))
                    Divider()
                    LabeledContent("Окончание", value: card.clockOutAt.map { dateLabel($0, lang: settings.lang) } ?? "Смена продолжается")
                    Divider()
                    LabeledContent("Перерыв", value: "\(card.breakMinutes) мин")
                    Divider()
                    LabeledContent("Учтено", value: "\(card.workedMinutes / 60) ч \(card.workedMinutes % 60) мин")
                }
            }
            if card.status != "open" && platform.hasPermission("time.request_correction") {
                PlatformPrimaryButton(title: "Запросить корректировку", icon: "clock.arrow.circlepath") { showCorrection = true }
            }
        }
        .sheet(isPresented: $showCorrection) { TimeCorrectionForm(card: card) }
        .navigationTitle("Табель").platformNavigationStyle()
    }
}

private struct TimeCorrectionForm: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    let card: PlatformTimecard
    @State private var changeStart = false
    @State private var changeEnd = false
    @State private var changeBreak = false
    @State private var start = Date()
    @State private var end = Date()
    @State private var breakMinutes = 0
    @State private var reason = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Что исправить") {
                    Toggle("Время начала", isOn: $changeStart)
                    if changeStart { DatePicker("Новое начало", selection: $start) }
                    Toggle("Время окончания", isOn: $changeEnd)
                    if changeEnd { DatePicker("Новое окончание", selection: $end) }
                    Toggle("Продолжительность перерыва", isOn: $changeBreak)
                    if changeBreak { Stepper("\(breakMinutes) минут", value: $breakMinutes, in: 0...360, step: 5) }
                }
                Section("Причина") { TextField("Минимум 5 символов", text: $reason, axis: .vertical).lineLimit(3...6) }
            }
            .navigationTitle("Корректировка").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Отмена") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Отправить") { Task { await submit() } }.disabled(reason.trimmingCharacters(in: .whitespacesAndNewlines).count < 5 || (!changeStart && !changeEnd && !changeBreak) || platform.isMutating) }
            }
            .onAppear { start = card.clockInAt.platformDate ?? Date(); end = card.clockOutAt?.platformDate ?? Date(); breakMinutes = card.breakMinutes }
        }
    }

    private func submit() async {
        do {
            try await platform.requestTimeCorrection(card: card, clockIn: changeStart ? start : nil, clockOut: changeEnd ? end : nil, breakMinutes: changeBreak ? breakMinutes : nil, reason: reason)
            settings.showToast("Запрос на корректировку отправлен"); dismiss()
        } catch { settings.showToast(error.localizedDescription) }
    }
}
