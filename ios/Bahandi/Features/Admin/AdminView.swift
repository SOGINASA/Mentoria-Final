import SwiftUI

struct AdminView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var tab = "users"
    @State private var users: [User] = []
    @State private var stores: [Store] = []
    @State private var employees: [Employee] = []
    @State private var loading = false
    @State private var form: AdminFormConfig?

    var body: some View {
        VStack(spacing: 0) {
            ChipBar(items: [
                ("users", settings.t("admin_users")),
                ("stores", settings.t("admin_stores")),
                ("employees", settings.t("admin_employees")),
            ], selection: $tab)
            .padding(.horizontal, 20).padding(.vertical, 12)

            if loading {
                Spacer(); ProgressView(); Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) { listContent }.padding(20)
                }
            }
        }
        .background(AppColor.bg)
        .navigationTitle(settings.t("nav_admin"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { form = createConfig() } label: { Image(systemName: "plus") }
            }
        }
        .task { await loadStores() }
        .task(id: tab) { await reload() }
        .sheet(item: $form) { cfg in
            AdminFormView(config: cfg, stores: stores) { Task { await reload() } }
        }
    }

    @ViewBuilder private var listContent: some View {
        switch tab {
        case "users":
            ForEach(users) { u in
                AdminRow(name: u.fullName, title: u.fullName,
                         sub: "@\(u.username)" + ((u.store?.name).map { " · \($0)" } ?? ""),
                         badge: roleLabel(u.role), badgeColors: roleColor(u.role),
                         active: u.isActive ?? true) { form = .editUser(u) }
            }
        case "stores":
            ForEach(stores) { s in
                AdminRow(icon: "building.2", title: s.name, sub: s.address ?? s.iikoStoreId ?? "—",
                         active: s.isActive ?? true) { form = .editStore(s) }
            }
        default:
            ForEach(employees) { e in
                AdminRow(name: e.fullName, title: e.fullName,
                         sub: storeSub(e), active: e.isActive ?? true) { form = .editEmployee(e) }
            }
        }
    }

    private func storeSub(_ e: Employee) -> String {
        [e.position, stores.first { $0.id == e.storeId }?.name].compactMap { $0 }.joined(separator: " · ")
    }

    private func createConfig() -> AdminFormConfig {
        switch tab { case "stores": return .newStore; case "employees": return .newEmployee; default: return .newUser }
    }

    private func reload() async {
        loading = true; defer { loading = false }
        switch tab {
        case "users": users = (try? await APIClient.shared.adminUsers().users) ?? []
        case "stores": stores = (try? await APIClient.shared.stores().stores) ?? []
        default: employees = (try? await APIClient.shared.employees().employees) ?? []
        }
    }
    private func loadStores() async { stores = (try? await APIClient.shared.stores().stores) ?? [] }

    private func roleLabel(_ r: String) -> String {
        r == Role.reviewer ? settings.t("role_reviewer") : r == Role.admin ? settings.t("role_admin") : settings.t("role_sender")
    }
    private func roleColor(_ r: String) -> (Color, Color) {
        r == Role.admin ? (AppColor.orange, AppColor.orangeTint)
            : r == Role.reviewer ? (AppColor.green, AppColor.greenTint)
            : (AppColor.muted, AppColor.surface2)
    }
}

// Отдельный компонент строки — разгружает тайп-чекер.
struct AdminRow: View {
    var name: String? = nil
    var icon: String? = nil
    let title: String
    let sub: String
    var badge: String? = nil
    var badgeColors: (Color, Color) = (.gray, .gray)
    let active: Bool
    let tap: () -> Void

    var body: some View {
        HStack(spacing: 13) {
            avatar
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 14.5, weight: .semibold)).foregroundColor(AppColor.text).lineLimit(1)
                Text(sub.isEmpty ? "—" : sub).font(.system(size: 12.5)).foregroundColor(AppColor.muted).lineLimit(1)
            }
            Spacer(minLength: 4)
            if let badge {
                Text(badge).font(.system(size: 11, weight: .semibold))
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .foregroundColor(badgeColors.0).background(badgeColors.1).clipShape(Capsule())
            }
            Image(systemName: "chevron.right").foregroundColor(AppColor.faint).font(.system(size: 13))
        }
        .opacity(active ? 1 : 0.5)
        .padding(12).background(AppColor.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(AppColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .contentShape(Rectangle())
        .onTapGesture(perform: tap)
    }

    @ViewBuilder private var avatar: some View {
        if let icon {
            ZStack { Circle().fill(AppColor.surface2).frame(width: 44, height: 44)
                Image(systemName: icon).foregroundColor(AppColor.green) }
        } else {
            AvatarCircle(name: name, size: 44)
        }
    }
}
