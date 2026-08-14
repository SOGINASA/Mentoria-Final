import SwiftUI

struct PlatformSupportView: View {
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    @State private var showCreate = false

    var body: some View {
        PlatformScreen("Помощь и обращения", subtitle: "История вопросов и ответы ответственных команд") {
            PlatformPrimaryButton(title: "Новое обращение", icon: "square.and.pencil") { showCreate = true }
            if platform.cases.isEmpty {
                ContentUnavailableView("Обращений пока нет", systemImage: "bubble.left.and.bubble.right",
                                       description: Text("Создайте обращение — его статус и ответы появятся здесь."))
                    .frame(maxWidth: .infinity, minHeight: 260)
            } else {
                ForEach(platform.cases) { item in
                    NavigationLink { PlatformCaseDetailView(itemID: item.id) } label: {
                        PlatformCard {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: caseIcon(item.category))
                                    .font(.title3).foregroundStyle(AppColor.green)
                                    .frame(width: 42, height: 42).background(AppColor.greenTint)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(item.subject).font(.headline).foregroundStyle(AppColor.text).lineLimit(2)
                                    Text("\(item.reference) · \(statusTitle(item.status))")
                                        .font(.caption).foregroundStyle(AppColor.muted)
                                    if let message = item.messages.last?.body {
                                        Text(message).font(.subheadline).foregroundStyle(AppColor.muted).lineLimit(2)
                                    }
                                }
                                Spacer()
                                Image(systemName: "chevron.right").foregroundStyle(AppColor.faint)
                            }
                        }
                    }.buttonStyle(.plain)
                }
            }
        }
        .sheet(isPresented: $showCreate) { PlatformCreateCaseView() }
        .navigationTitle("Помощь").platformNavigationStyle()
    }
}

private struct PlatformCreateCaseView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    @State private var category = "other"
    @State private var subject = ""
    @State private var message = ""

    var body: some View {
        NavigationStack {
            Form {
                Picker("Кому", selection: $category) {
                    Text("Операционный вопрос").tag("operations")
                    Text("HR и документы").tag("hr")
                    Text("Зарплата и табель").tag("payroll")
                    Text("Другое").tag("other")
                }
                TextField("Тема", text: $subject)
                TextField("Опишите вопрос", text: $message, axis: .vertical).lineLimit(5...10)
            }
            .navigationTitle("Новое обращение").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Отмена") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Отправить") {
                        Task {
                            do {
                                try await platform.createCase(category: category, subject: subject, message: message)
                                settings.showToast("Обращение отправлено"); dismiss()
                            } catch { settings.showToast(error.localizedDescription) }
                        }
                    }.disabled(subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || message.count < 3 || platform.isMutating)
                }
            }
        }
        .presentationDetents([.large])
    }
}

private struct PlatformCaseDetailView: View {
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    let itemID: Int
    @State private var reply = ""

    private var item: SupportCaseRecord? { platform.cases.first { $0.id == itemID } }

    var body: some View {
        Group {
            if let item {
                PlatformScreen(item.subject, subtitle: "\(item.reference) · \(statusTitle(item.status))") {
                    ForEach(item.messages) { message in
                        PlatformCard {
                            VStack(alignment: .leading, spacing: 7) {
                                Text(message.authorId == item.authorId ? "Вы" : "Ответственный сотрудник")
                                    .font(.caption.bold()).foregroundStyle(AppColor.green)
                                Text(message.body).font(.body).foregroundStyle(AppColor.text)
                            }
                        }
                    }
                    if platform.hasPermission("cases.manage") {
                        PlatformCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Обработка обращения").font(.headline)
                                Picker("Статус", selection: Binding(get: { item.status }, set: { status in
                                    Task { do { try await platform.updateCaseStatus(item, status: status); settings.showToast("Статус обновлён") }
                                        catch { settings.showToast(error.localizedDescription) } }
                                })) {
                                    Text("Открыто").tag("open")
                                    Text("В работе").tag("in_progress")
                                    Text("Решено").tag("resolved")
                                    Text("Закрыто").tag("closed")
                                }.pickerStyle(.segmented).disabled(platform.isMutating)
                            }
                        }
                    }
                    if !["closed", "resolved"].contains(item.status) {
                        PlatformCard {
                            VStack(alignment: .leading, spacing: 12) {
                                TextField("Написать сообщение", text: $reply, axis: .vertical).lineLimit(3...7)
                                PlatformPrimaryButton(title: "Отправить", icon: "paperplane.fill", loading: platform.isMutating,
                                                      disabled: reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                                    let body = reply; reply = ""
                                    Task { do { try await platform.sendMessage(case: item, body: body) }
                                        catch { reply = body; settings.showToast(error.localizedDescription) } }
                                }
                            }
                        }
                    }
                }
            } else { ContentUnavailableView("Обращение не найдено", systemImage: "questionmark.bubble") }
        }
        .navigationTitle("Обращение").platformNavigationStyle()
    }
}

struct PlatformProfileView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore
    @EnvironmentObject private var settings: AppSettings
    @State private var email = ""
    @State private var phone = ""
    @State private var saving = false
    @State private var showPassword = false
    @State private var showBiometricSetup = false

    var body: some View {
        PlatformScreen("Профиль", subtitle: roleTitle(auth.role)) {
            PlatformCard {
                HStack(spacing: 14) {
                    Text(initials).font(.title2.bold()).foregroundStyle(.white)
                        .frame(width: 58, height: 58).background(AppColor.green).clipShape(Circle())
                    VStack(alignment: .leading, spacing: 4) {
                        Text(auth.user?.fullName ?? "Сотрудник").font(.title3.bold()).foregroundStyle(AppColor.text)
                        Text(auth.user?.store?.name ?? "Без привязки к точке").font(.subheadline).foregroundStyle(AppColor.muted)
                    }
                }
            }
            PlatformSectionTitle(title: "Контактные данные")
            PlatformCard {
                VStack(spacing: 16) {
                    LabeledContent("Логин", value: auth.user?.username ?? "—")
                    Divider()
                    TextField("Email", text: $email).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                    Divider()
                    TextField("Телефон", text: $phone).keyboardType(.phonePad)
                    PlatformPrimaryButton(title: "Сохранить", icon: "checkmark", loading: saving) {
                        Task {
                            saving = true; defer { saving = false }
                            do { try await auth.updateProfile(email: email, phone: phone); settings.showToast("Профиль обновлён") }
                            catch { settings.showToast(error.localizedDescription) }
                        }
                    }
                }
            }
            PlatformCard {
                HStack {
                    VStack(alignment: .leading, spacing: 4) { Text("Быстрый вход").font(.headline); Text(BiometricStore.isEnabled ? "Face ID настроен" : "Требуется подтверждение паролем").font(.caption).foregroundStyle(AppColor.muted) }
                    Spacer()
                    Button(BiometricStore.isEnabled ? "Отключить" : "Настроить") {
                        if BiometricStore.isEnabled { BiometricStore.disable(); settings.showToast("Быстрый вход отключён") }
                        else { showBiometricSetup = true }
                    }.buttonStyle(.bordered).tint(AppColor.green)
                }
                Text("Токены сессии хранятся в Keychain только на этом устройстве.")
                    .font(.caption).foregroundStyle(AppColor.muted).padding(.top, 6)
            }
            Button { showPassword = true } label: { Label("Изменить пароль", systemImage: "key").frame(maxWidth: .infinity, minHeight: 52) }.buttonStyle(.bordered).tint(AppColor.green)
            Button(role: .destructive) { platform.reset(); auth.logout() } label: {
                Label("Выйти из аккаунта", systemImage: "rectangle.portrait.and.arrow.right")
                    .frame(maxWidth: .infinity, minHeight: 52)
            }.buttonStyle(.bordered).buttonBorderShape(.roundedRectangle(radius: 16))
                .accessibilityIdentifier("profile.logout")
        }
        .onAppear { email = auth.user?.email ?? ""; phone = auth.user?.phone ?? "" }
        .sheet(isPresented: $showPassword) { ChangePasswordSheet() }
        .sheet(isPresented: $showBiometricSetup) { if let user = auth.user { BiometricSetupSheet(user: user) { settings.showToast("Face ID настроен") } } }
        .navigationTitle("Профиль").platformNavigationStyle()
    }

    private var initials: String {
        (auth.user?.fullName.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined() ?? "B").uppercased()
    }
}

private struct ChangePasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var settings: AppSettings
    @State private var current = ""
    @State private var newPassword = ""
    @State private var confirmation = ""
    @State private var saving = false
    var body: some View {
        NavigationStack {
            Form {
                Section("Текущий пароль") { SecureField("Введите текущий пароль", text: $current).textContentType(.password) }
                Section("Новый пароль") { SecureField("Минимум 6 символов", text: $newPassword).textContentType(.newPassword); SecureField("Повторите новый пароль", text: $confirmation).textContentType(.newPassword); if !confirmation.isEmpty && confirmation != newPassword { Text("Пароли не совпадают").font(.caption).foregroundStyle(AppColor.red) } }
            }
            .navigationTitle("Изменить пароль").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Отмена") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button(saving ? "Сохраняем…" : "Сохранить") { Task { await save() } }.disabled(current.isEmpty || newPassword.count < 6 || newPassword != confirmation || saving) } }
        }
    }
    private func save() async { saving = true; defer { saving = false }; do { _ = try await APIClient.shared.changePassword(current: current, new: newPassword); BiometricStore.disable(); settings.showToast("Пароль изменён. Быстрый вход отключён."); dismiss() } catch { settings.showToast(error.localizedDescription) } }
}

private func caseIcon(_ value: String) -> String {
    switch value { case "hr": return "person.text.rectangle"; case "payroll": return "banknote"; case "operations": return "gearshape.2"; default: return "questionmark.bubble" }
}

func statusTitle(_ value: String) -> String {
    ["open": "Открыто", "in_progress": "В работе", "resolved": "Решено", "closed": "Закрыто",
     "pending": "Ожидает", "approved": "Одобрено", "rejected": "Отклонено", "processing": "Готовится",
     "submitted": "На проверке", "completed": "Выполнено", "active": "Активно"][value] ?? value
}

func roleTitle(_ role: String) -> String {
    [Role.sender: "Сотрудник", Role.manager: "Менеджер", Role.reviewer: "Проверяющий",
     Role.hr: "HR", Role.finance: "Финансы", Role.operations: "Операционный руководитель",
     Role.admin: "Администратор"][role] ?? role
}
