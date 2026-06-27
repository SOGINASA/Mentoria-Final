import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var auth: AuthStore

    private var roleLabel: String {
        switch auth.role {
        case Role.reviewer: return settings.t("role_reviewer")
        case Role.admin: return settings.t("role_admin")
        default: return settings.t("role_sender")
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 8) {
                    Text(initials(auth.user?.fullName)).font(.system(size: 32, weight: .semibold)).foregroundColor(.white)
                        .frame(width: 84, height: 84)
                        .background(LinearGradient(colors: [AppColor.green, AppColor.greenD], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .clipShape(Circle())
                    Text(auth.user?.fullName ?? "").font(AppFont.head(23)).foregroundColor(AppColor.text)
                    Text(roleLabel).font(.system(size: 12.5, weight: .semibold)).foregroundColor(AppColor.green)
                        .padding(.horizontal, 13).padding(.vertical, 5).background(AppColor.greenTint).clipShape(Capsule())
                }
                .padding(.top, 8)

                VStack(spacing: 0) {
                    if let name = auth.user?.store?.name {
                        infoRow(icon: "mappin.and.ellipse", label: settings.t("f_point"), value: name)
                        Divider().background(AppColor.line2)
                    }
                    infoRow(icon: "person", label: settings.t("f_id"), value: "BHD-\(auth.user?.id ?? 0)")
                }
                .background(AppColor.surface).overlay(RoundedRectangle(cornerRadius: 16).stroke(AppColor.line, lineWidth: 1)).clipShape(RoundedRectangle(cornerRadius: 16))

                VStack(spacing: 14) {
                    HStack {
                        Label(settings.t("language"), systemImage: "globe").font(.system(size: 14)).foregroundColor(AppColor.text)
                        Spacer()
                        Picker("", selection: $settings.lang) { Text("RU").tag("ru"); Text("KZ").tag("kz") }
                            .pickerStyle(.segmented).frame(width: 110)
                    }
                    Divider().background(AppColor.line2)
                    HStack {
                        Label(settings.t("theme"), systemImage: "moon").font(.system(size: 14)).foregroundColor(AppColor.text)
                        Spacer()
                        Picker("", selection: $settings.theme) {
                            Text(settings.t("theme_system")).tag(AppTheme.system)
                            Text(settings.t("theme_light")).tag(AppTheme.light)
                            Text(settings.t("theme_dark")).tag(AppTheme.dark)
                        }
                        .pickerStyle(.menu).tint(AppColor.green)
                    }
                }
                .padding(16).background(AppColor.surface).overlay(RoundedRectangle(cornerRadius: 16).stroke(AppColor.line, lineWidth: 1)).clipShape(RoundedRectangle(cornerRadius: 16))

                Button { auth.logout() } label: {
                    Label(settings.t("logout"), systemImage: "rectangle.portrait.and.arrow.right").font(.system(size: 14.5, weight: .semibold))
                        .foregroundColor(AppColor.red).frame(maxWidth: .infinity).frame(height: 50)
                        .background(AppColor.surface).overlay(RoundedRectangle(cornerRadius: 14).stroke(AppColor.line, lineWidth: 1.5)).clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(20)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(AppColor.bg)
        .navigationTitle(settings.t("nav_profile"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func infoRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundColor(AppColor.green)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 11.5)).foregroundColor(AppColor.muted)
                Text(value).font(.system(size: 14, weight: .semibold)).foregroundColor(AppColor.text)
            }
            Spacer()
        }
        .padding(15)
    }
}
