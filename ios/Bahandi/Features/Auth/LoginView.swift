import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var settings: AppSettings

    @State private var identifier = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false

    private let demo: [(String, String, String)] = [
        ("role_sender", "sender1", "sender123"),
        ("role_reviewer", "reviewer", "reviewer123"),
        ("role_admin", "admin", "admin12345"),
    ]

    var body: some View {
        ZStack {
            AppColor.bg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    HStack {
                        Spacer()
                        Picker("", selection: $settings.lang) {
                            Text("RU").tag("ru"); Text("KZ").tag("kz")
                        }
                        .pickerStyle(.segmented).frame(width: 110)
                    }
                    .padding(.bottom, 24)

                    BahandiLogo(size: .lg).padding(.top, 12)
                    Text(settings.t("login_title")).font(AppFont.head(25)).foregroundColor(AppColor.text).padding(.top, 26)
                    Text(settings.t("login_sub")).font(.system(size: 14)).foregroundColor(AppColor.muted).padding(.top, 4)

                    VStack(spacing: 14) {
                        field(icon: "person", title: settings.t("login_login"), text: $identifier, placeholder: settings.t("login_ph_login"))
                        field(icon: "lock", title: settings.t("login_pass"), text: $password, placeholder: "••••••", secure: true)

                        if let error {
                            Text(error).font(.system(size: 13, weight: .medium))
                                .foregroundColor(AppColor.red).frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12).background(AppColor.redTint).clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        Button { Task { await submit(identifier, password) } } label: {
                            ZStack {
                                if loading { ProgressView().tint(.white) }
                                else { Text(settings.t("login_btn")).font(AppFont.head(18)) }
                            }
                            .frame(maxWidth: .infinity).frame(height: 54)
                            .foregroundColor(.white).background(AppColor.green)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        .disabled(loading)

                        HStack(spacing: 8) {
                            Rectangle().fill(AppColor.line).frame(height: 1)
                            Text(settings.t("login_demo")).font(.system(size: 11.5)).foregroundColor(AppColor.faint).fixedSize()
                            Rectangle().fill(AppColor.line).frame(height: 1)
                        }

                        HStack(spacing: 8) {
                            ForEach(demo, id: \.0) { item in
                                Button { Task { await submit(item.1, item.2) } } label: {
                                    Text(settings.t(item.0)).font(.system(size: 12.5, weight: .semibold))
                                        .frame(maxWidth: .infinity).frame(height: 44)
                                        .foregroundColor(AppColor.text).background(AppColor.surface)
                                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(AppColor.line, lineWidth: 1.5))
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                }
                            }
                        }
                    }
                    .padding(.top, 26)
                }
                .frame(maxWidth: 400)
                .padding(24)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func field(icon: String, title: String, text: Binding<String>, placeholder: String, secure: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.system(size: 13, weight: .semibold)).foregroundColor(AppColor.text)
            HStack(spacing: 10) {
                Image(systemName: icon).foregroundColor(AppColor.faint)
                if secure {
                    SecureField(placeholder, text: text)
                } else {
                    TextField(placeholder, text: text).textInputAutocapitalization(.never).autocorrectionDisabled()
                }
            }
            .font(.system(size: 15)).foregroundColor(AppColor.text)
            .padding(.horizontal, 14).frame(height: 52)
            .background(AppColor.surface)
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(AppColor.line, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 13))
        }
    }

    private func submit(_ id: String, _ pass: String) async {
        guard !id.isEmpty, !pass.isEmpty else { return }
        loading = true; error = nil
        do { try await auth.login(identifier: id, password: pass) }
        catch let e as APIError { self.error = (e.status == 401 || e.status == 403) ? settings.t("login_error") : e.message }
        catch { self.error = settings.t("error_generic") }
        loading = false
    }
}
