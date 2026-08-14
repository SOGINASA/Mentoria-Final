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
    let employees: [Employee]
    let onSaved: () -> Void

    // общие поля
    @State private var fullName = ""
    @State private var username = ""
    @State private var password = ""
    @State private var role = Role.sender
    @State private var storeId: Int?
    @State private var employeeId: Int?
    @State private var email = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var iikoStoreId = ""
    @State private var position = ""
    @State private var isActive = true
    @State private var supervisedStoreIds: Set<Int> = []
    @State private var scopeStoreIds: Set<Int> = []
    @State private var iikoEmployeeId = ""

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
                        if role == Role.sender { employeePicker }
                        if role == Role.reviewer {
                            Section(settings.t("supervised_stores")) {
                                ForEach(stores) { s in
                                    Toggle(s.name, isOn: Binding(get: { supervisedStoreIds.contains(s.id) }, set: { on in if on { supervisedStoreIds.insert(s.id) } else { supervisedStoreIds.remove(s.id) } }))
                                }
                            }
                        }
                        if [Role.sender, Role.manager].contains(role) {
                            Section("Дополнительные точки доступа") {
                                Text("Основная точка добавляется автоматически.").font(.caption).foregroundStyle(AppColor.muted)
                                ForEach(stores) { store in
                                    Toggle(store.name, isOn: Binding(get: { scopeStoreIds.contains(store.id) }, set: { enabled in
                                        if enabled { scopeStoreIds.insert(store.id) } else { scopeStoreIds.remove(store.id) }
                                    }))
                                }
                            }
                        }
                        TextField(settings.t("f_email"), text: $email).textInputAutocapitalization(.never).autocorrectionDisabled()
                        TextField("Телефон", text: $phone).keyboardType(.phonePad)
                        if isEdit { Toggle(settings.t("admin_active"), isOn: $isActive) }
                    }
                case .store:
                    Section {
                        TextField(settings.t("f_name"), text: $fullName)
                        TextField(settings.t("f_address"), text: $address)
                        TextField("iiko ID", text: $iikoStoreId)
                        if isEdit { Toggle(settings.t("admin_active"), isOn: $isActive) }
                    }
                case .employee:
                    Section {
                        TextField(settings.t("f_fullname"), text: $fullName)
                        TextField(settings.t("f_position"), text: $position)
                        TextField("iiko ID сотрудника", text: $iikoEmployeeId)
                        storePicker
                        if isEdit { Toggle(settings.t("admin_active"), isOn: $isActive) }
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
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96))], spacing: 8) {
                roleChip(Role.sender, settings.t("role_sender"), AppColor.muted, AppColor.surface2)
                roleChip(Role.manager, settings.t("role_manager"), AppColor.green, AppColor.greenTint)
                roleChip(Role.reviewer, settings.t("role_reviewer"), AppColor.green, AppColor.greenTint)
                roleChip(Role.hr, settings.t("role_hr"), AppColor.green, AppColor.greenTint)
                roleChip(Role.finance, settings.t("role_finance"), AppColor.green, AppColor.greenTint)
                roleChip(Role.operations, settings.t("role_operations"), AppColor.orange, AppColor.orangeTint)
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

    private var employeePicker: some View {
        Picker(settings.t("f_self_employee"), selection: $employeeId) {
            Text(settings.t("no_employee_link")).tag(Optional<Int>.none)
            ForEach(employees.filter { storeId == nil || $0.storeId == storeId }) { employee in
                Text(employee.fullName).tag(Optional(employee.id))
            }
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
            fullName = u.fullName; role = u.role; storeId = u.storeId; employeeId = u.employeeId; email = u.email ?? ""; phone = u.phone ?? ""; isActive = u.isActive ?? true; supervisedStoreIds = Set(u.supervisedStoreIds ?? []); scopeStoreIds = Set(u.storeScopes?.map(\.storeId) ?? [])
        case .editStore(let s):
            fullName = s.name; address = s.address ?? ""; iikoStoreId = s.iikoStoreId ?? ""; isActive = s.isActive ?? true
        case .editEmployee(let e):
            fullName = e.fullName; position = e.position ?? ""; storeId = e.storeId; iikoEmployeeId = e.iikoEmployeeId ?? ""; isActive = e.isActive ?? true
        default: break
        }
    }

    private func save() async {
        saving = true; error = nil
        do {
            switch config {
            case .newUser:
                let result = try await APIClient.shared.adminCreateUser(["username": username, "password": password, "full_name": fullName, "role": role, "store_id": storeId, "employee_id": role == Role.sender ? employeeId : nil, "supervised_store_ids": role == Role.reviewer ? Array(supervisedStoreIds) : [], "email": email.isEmpty ? nil : email, "phone": phone.isEmpty ? nil : phone])
                try await saveScopes(userID: result.user.id)
            case .editUser(let u):
                var p: [String: Any?] = ["full_name": fullName, "role": role, "store_id": storeId, "employee_id": role == Role.sender ? employeeId : nil, "supervised_store_ids": role == Role.reviewer ? Array(supervisedStoreIds) : [], "email": email.isEmpty ? nil : email, "phone": phone.isEmpty ? nil : phone, "is_active": isActive]
                if !password.isEmpty { p["password"] = password }
                _ = try await APIClient.shared.adminUpdateUser(u.id, p)
                try await saveScopes(userID: u.id)
            case .newStore:
                _ = try await APIClient.shared.adminCreateStore(["name": fullName, "address": address, "iiko_store_id": iikoStoreId])
            case .editStore(let s):
                _ = try await APIClient.shared.adminUpdateStore(s.id, ["name": fullName, "address": address, "iiko_store_id": iikoStoreId, "is_active": isActive])
            case .newEmployee:
                _ = try await APIClient.shared.adminCreateEmployee(["full_name": fullName, "position": position, "store_id": storeId, "iiko_employee_id": iikoEmployeeId])
            case .editEmployee(let e):
                _ = try await APIClient.shared.adminUpdateEmployee(e.id, ["full_name": fullName, "position": position, "store_id": storeId, "iiko_employee_id": iikoEmployeeId, "is_active": isActive])
            }
            settings.showToast(settings.t("save"))
            onSaved()
            dismiss()
        } catch { self.error = (error as? APIError)?.message ?? settings.t("error_generic") }
        saving = false
    }

    private func saveScopes(userID: Int) async throws {
        let scope = role == Role.sender ? "employee" : role == Role.manager ? "manager" : role == Role.reviewer ? "supervisor" : nil
        var ids = role == Role.reviewer ? supervisedStoreIds : scopeStoreIds
        if [Role.sender, Role.manager].contains(role), let storeId { ids.insert(storeId) }
        let values: [[String: Any]] = scope.map { value in ids.map { ["store_id": $0, "scope": value] } } ?? []
        _ = try await APIClient.shared.adminReplaceScopes(userID, values)
    }
}
