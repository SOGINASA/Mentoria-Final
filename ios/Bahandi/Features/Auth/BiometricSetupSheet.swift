import SwiftUI

// Привязка биометрии: подтверждение пароля → анимация снятия отпечатка.
struct BiometricSetupSheet: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let user: User
    let onEnabled: () -> Void

    private enum Phase { case form, enrolling, done }
    @State private var phase: Phase = .form
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        VStack(spacing: 0) {
            Capsule().fill(AppColor.line).frame(width: 38, height: 4).padding(.top, 10).padding(.bottom, 18)

            if phase == .form {
                form
            } else {
                VStack(spacing: 0) {
                    FingerprintView(phase: phase == .done ? .success : .scanning, size: 140)
                    Text(phase == .done ? settings.t("bio_enrolled") : settings.t("bio_enrolling"))
                        .font(AppFont.head(19)).foregroundColor(phase == .done ? AppColor.green : AppColor.text)
                        .padding(.top, 22)
                    if phase == .enrolling {
                        Text(settings.t("bio_scan_sub")).font(.system(size: 13)).foregroundColor(AppColor.muted).padding(.top, 4)
                    }
                }
                .padding(.vertical, 16)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 22)
        .presentationDetents([.height(phase == .form ? 360 : 320)])
        .background(AppColor.surface)
        .interactiveDismissDisabled(phase != .form)
    }

    private var form: some View {
        VStack(spacing: 0) {
            ZStack { RoundedRectangle(cornerRadius: 16).fill(AppColor.greenTint).frame(width: 56, height: 56)
                Image(systemName: "touchid").font(.system(size: 28)).foregroundColor(AppColor.green) }
            Text(settings.t("bio_enroll_title")).font(AppFont.head(20)).foregroundColor(AppColor.text).padding(.top, 12)
            Text(settings.t("bio_enroll_sub")).font(.system(size: 13)).foregroundColor(AppColor.muted)
                .multilineTextAlignment(.center).padding(.top, 4).padding(.horizontal, 8)

            HStack(spacing: 10) {
                Image(systemName: "lock").foregroundColor(AppColor.faint)
                SecureField(settings.t("login_pass"), text: $password)
                    .font(.system(size: 15)).foregroundColor(AppColor.text)
                    .onSubmit(confirm)
            }
            .padding(.horizontal, 14).frame(height: 52)
            .background(AppColor.surface)
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(AppColor.line, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 13))
            .padding(.top, 18)

            if let error {
                Text(error).font(.system(size: 13, weight: .medium)).foregroundColor(AppColor.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12).background(AppColor.redTint).clipShape(RoundedRectangle(cornerRadius: 12)).padding(.top, 10)
            }

            HStack(spacing: 12) {
                Button { dismiss() } label: {
                    Text(settings.t("cancel")).font(.system(size: 14.5, weight: .semibold)).foregroundColor(AppColor.text)
                        .frame(maxWidth: .infinity).frame(height: 50).background(AppColor.surface)
                        .overlay(RoundedRectangle(cornerRadius: 13).stroke(AppColor.line, lineWidth: 1.5)).clipShape(RoundedRectangle(cornerRadius: 13))
                }
                Button(action: confirm) {
                    Group { if busy { ProgressView().tint(.white) } else { Text(settings.t("bio_enroll_btn")).font(AppFont.head(16)) } }
                        .foregroundColor(.white).frame(maxWidth: .infinity).frame(height: 50)
                        .background(AppColor.green).clipShape(RoundedRectangle(cornerRadius: 13))
                }
                .disabled(busy || password.isEmpty)
            }
            .padding(.top, 18)
        }
    }

    private func confirm() {
        guard !password.isEmpty, !busy else { return }
        guard BiometricAuth.isAvailable() else { error = settings.t("bio_unsupported"); return }
        busy = true; error = nil
        Task {
            // 1) проверяем пароль реальным логином (и обновляем токен)
            do {
                try await auth.login(identifier: user.username, password: password)
            } catch let e as APIError {
                error = (e.status == 401 || e.status == 403) ? settings.t("bio_wrong_pass") : e.message
                busy = false; return
            } catch {
                self.error = settings.t("error_generic"); busy = false; return
            }
            // 2) подтверждаем настоящей биометрией (Face ID / Touch ID)
            do {
                try await BiometricAuth.authenticate(reason: settings.t("bio_enroll_face"))
            } catch is BiometricCancelled {
                busy = false; return
            } catch {
                self.error = settings.t("bio_unsupported"); busy = false; return
            }
            // 3) сохраняем + анимация
            BiometricStore.enable(identifier: user.username, name: user.fullName, password: password)
            withAnimation { phase = .enrolling }
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            withAnimation { phase = .done }
            try? await Task.sleep(nanoseconds: 900_000_000)
            onEnabled()
            dismiss()
        }
    }
}
