import SwiftUI

enum AdminFormConfig: Identifiable {
    case newUser, editUser(User)
    case newStore, editStore(Store)
    case newEmployee, editEmployee(Employee)

    var id: String {
        switch self {
        case .newUser: return "newUser"
        case .editUser(let u): return "user-\(u.id)"
        case .newStore: return "newStore"
        case .editStore(let s): return "store-\(s.id)"
        case .newEmployee: return "newEmployee"
        case .editEmployee(let e): return "emp-\(e.id)"
        }
    }
}

struct AdminFormView: View {
    @EnvironmentObject var settings: AppSettings
    @Environment(\.dismiss) private var dismiss
    let config: AdminFormConfig
    let stores: [Store]
    let onSaved: () -> Void

    // общие поля
    @State private var fullName = ""
    @State private var username = ""
    @State private var password = ""
    @State private var role = Role.sender
    @State private var storeId: Int?
    @State private var email = ""
    @State private var address = ""
    @State private var iikoStoreId = ""
    @State private var position = ""
    @State private var isActive = true

    @State private var saving = false
    @State private var error: String?

    private enum Kind { case user, store, employee }
    private var kind: Kind {
        switch config { case .newUser, .editUser: return .user; case .newStore, .editStore: return .store; default: return .employee }
    }
    private var isEdit: Bool {
        switch config { case .editUser, .editStore, .editEmployee: return true; default: return false }
    }

    var body: some View {
        NavigationStack {
            Form {
                if let error { Text(error).foregroundColor(AppColor.red).font(.system(size: 13)) }

                switch kind {
                case .user:
                    Section {
                        TextField(settings.t("f_fullname"), text: $fullName)
                        if !isEdit { TextField(settings.t("f_username"), text: $username).textInputAutocapitalization(.never).autocorrectionDisabled() }
                        SecureField(settings.t("f_password"), text: $password)
                        rolePicker
                        storePicker
                        TextField(settings.t("f_email"), text: $email).textInputAutocapitalization(.never).autocorrectionDisabled()
                        if isEdit { Toggle(settings.t("admin_active"), isOn: $isActive) }
                    }
                case .store:
                    Section {
                        TextField(settings.t("f_name"), text: $fullName)
                        TextField(settings.t("f_address"), text: $address)
                        TextField("iiko ID", text: $iikoStoreId)
                    }
                case .employee:
                    Section {
                        TextField(settings.t("f_fullname"), text: $fullName)
                        TextField(settings.t("f_position"), text: $position)
                        storePicker
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(settings.t("cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEdit ? settings.t("save") : settings.t("create")) { Task { await save() } }.disabled(saving)
                }
            }
            .onAppear(perform: prefill)
            .tint(AppColor.green)
        }
    }

    // Явный выбор роли — чипы (создание и редактирование пользователя).
    private var rolePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(settings.t("f_role")).font(.system(size: 12.5, weight: .semibold)).foregroundColor(AppColor.muted)
            HStack(spacing: 8) {
                roleChip(Role.sender, settings.t("role_sender"), AppColor.muted, AppColor.surface2)
                roleChip(Role.reviewer, settings.t("role_reviewer"), AppColor.green, AppColor.greenTint)
                roleChip(Role.admin, settings.t("role_admin"), AppColor.orange, AppColor.orangeTint)
            }
        }
        .padding(.vertical, 4)
    }

    private func roleChip(_ value: String, _ label: String, _ fg: Color, _ bg: Color) -> some View {
        let active = role == value
        return Button { role = value } label: {
            Text(label)
                .font(.system(size: 11.5, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity).frame(height: 38)
                .foregroundColor(active ? fg : AppColor.muted)
                .background(active ? bg : AppColor.surface)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(active ? fg : AppColor.line, lineWidth: 1.5))
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    private var storePicker: some View {
        Picker(settings.t("f_point"), selection: $storeId) {
            Text(settings.t("no_store")).tag(Optional<Int>.none)
            ForEach(stores) { s in Text(s.name).tag(Optional(s.id)) }
        }
    }

    private var title: String {
        switch kind {
        case .user: return isEdit ? settings.t("admin_users") : settings.t("admin_add")
        case .store: return settings.t("admin_stores")
        case .employee: return settings.t("admin_employees")
        }
    }

    private func prefill() {
        switch config {
        case .editUser(let u):
            fullName = u.fullName; role = u.role; storeId = u.storeId; email = u.email ?? ""; isActive = u.isActive ?? true
        case .editStore(let s):
            fullName = s.name; address = s.address ?? ""; iikoStoreId = s.iikoStoreId ?? ""
        case .editEmployee(let e):
            fullName = e.fullName; position = e.position ?? ""; storeId = e.storeId
        default: break
        }
    }

    private func save() async {
        saving = true; error = nil
        do {
            switch config {
            case .newUser:
                _ = try await APIClient.shared.adminCreateUser(["username": username, "password": password, "full_name": fullName, "role": role, "store_id": storeId, "email": email.isEmpty ? nil : email])
            case .editUser(let u):
                var p: [String: Any?] = ["full_name": fullName, "role": role, "store_id": storeId, "email": email.isEmpty ? nil : email, "is_active": isActive]
                if !password.isEmpty { p["password"] = password }
                _ = try await APIClient.shared.adminUpdateUser(u.id, p)
            case .newStore:
                _ = try await APIClient.shared.adminCreateStore(["name": fullName, "address": address, "iiko_store_id": iikoStoreId])
            case .editStore(let s):
                _ = try await APIClient.shared.adminUpdateStore(s.id, ["name": fullName, "address": address, "iiko_store_id": iikoStoreId])
            case .newEmployee:
                _ = try await APIClient.shared.adminCreateEmployee(["full_name": fullName, "position": position, "store_id": storeId])
            case .editEmployee(let e):
                _ = try await APIClient.shared.adminUpdateEmployee(e.id, ["full_name": fullName, "position": position, "store_id": storeId])
            }
            settings.showToast(settings.t("save"))
            onSaved()
            dismiss()
        } catch { self.error = (error as? APIError)?.message ?? settings.t("error_generic") }
        saving = false
    }
}
