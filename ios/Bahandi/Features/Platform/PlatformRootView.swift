import SwiftUI

struct StaffPlatformTabView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var platform: PlatformStore

    var body: some View {
        TabView {
            switch auth.role {
            case Role.manager:
                tab(PlatformTodayView(), "Сегодня", "house")
                tab(RoleWorkspaceView(kind: .manager), "Точка", "briefcase")
                tab(PlatformApprovalsView(), "Согласования", "checkmark.circle")
                tab(EmployeeServicesView(), "Сервисы", "square.grid.2x2")
                tab(PlatformProfileView(), "Профиль", "person")
            case Role.reviewer:
                tab(PlatformTodayView(), "Сегодня", "house")
                tab(ReviewerControlView(), "Контроль", "checkmark.shield")
                tab(PlatformApprovalsView(), "Согласования", "checkmark.circle")
                tab(EmployeeServicesView(), "Сервисы", "square.grid.2x2")
                tab(PlatformProfileView(), "Профиль", "person")
            case Role.hr:
                tab(PlatformTodayView(), "Сегодня", "house")
                tab(HRWorkspaceView(), "HR", "person.2")
                tab(PlatformApprovalsView(), "Заявки", "checkmark.circle")
                tab(EmployeeServicesView(), "Сервисы", "square.grid.2x2")
                tab(PlatformProfileView(), "Профиль", "person")
            case Role.finance:
                tab(PlatformTodayView(), "Сегодня", "house")
                tab(FinanceWorkspaceView(), "Финансы", "banknote")
                tab(EmployeeServicesView(), "Сервисы", "square.grid.2x2")
                tab(PlatformProfileView(), "Профиль", "person")
            case Role.operations:
                tab(PlatformTodayView(), "Сегодня", "house")
                tab(OperationsWorkspaceView(), "Операции", "chart.bar")
                tab(OperationsManagementView(), "Управление", "building.2")
                tab(PlatformApprovalsView(), "Решения", "checkmark.circle")
                tab(PlatformProfileView(), "Профиль", "person")
            case Role.admin:
                tab(RoleWorkspaceView(kind: .admin), "Система", "slider.horizontal.3")
                tab(AdminView(), "Доступы", "person.badge.key")
                tab(ReviewQueueView(), "Списания", "tray.full")
                tab(PlatformProfileView(), "Профиль", "person")
            default:
                tab(PlatformTodayView(), "Сегодня", "house")
                tab(PlatformShiftsView(), "Смены", "calendar")
                tab(PlatformTasksView(), "Задачи", "checklist")
                tab(EmployeeServicesView(), "Сервисы", "square.grid.2x2")
                tab(PlatformProfileView(), "Профиль", "person")
            }
        }
        .tint(AppColor.green)
        .accessibilityIdentifier("staff-platform.\(auth.role)")
        .bahandiToast()
        .task { await platform.load(role: auth.role) }
        .onChange(of: auth.role) { _, role in
            platform.reset()
            guard !role.isEmpty else { return }
            Task { await platform.load(role: role) }
        }
    }

    private func tab<V: View>(_ view: V, _ title: String, _ icon: String) -> some View {
        NavigationStack {
            view.toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink { PlatformNotificationsView() } label: {
                        Image(systemName: platform.unreadNotifications > 0 ? "bell.badge.fill" : "bell")
                            .accessibilityLabel(platform.unreadNotifications > 0 ? "Уведомления, новых: \(platform.unreadNotifications)" : "Уведомления")
                    }
                }
            }
        }.tabItem { Label(title, systemImage: icon) }
    }
}
