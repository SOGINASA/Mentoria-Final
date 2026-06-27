import SwiftUI

struct RootView: View {
    @EnvironmentObject var auth: AuthStore

    var body: some View {
        Group {
            switch auth.status {
            case .loading:
                ZStack { AppColor.bg.ignoresSafeArea(); ProgressView() }
            case .guest:
                LoginView()
            case .authed:
                MainTabView()
            }
        }
        .animation(.easeInOut, value: auth.status == .authed)
    }
}

struct MainTabView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        TabView {
            switch auth.role {
            case Role.reviewer:
                tab(ReviewQueueView(), "nav_queue", "tray.full")
                tab(HistoryView(), "nav_history", "clock")
                tab(ProfileView(), "nav_profile", "person")
            case Role.admin:
                tab(AdminView(), "nav_admin", "slider.horizontal.3")
                tab(ReviewQueueView(), "nav_queue", "tray.full")
                tab(ProfileView(), "nav_profile", "person")
            default:
                tab(HomeView(), "nav_home", "house")
                tab(CreateWriteOffView(), "nav_create", "plus.circle")
                tab(MyRequestsView(), "nav_my", "list.bullet.rectangle")
                tab(ProfileView(), "nav_profile", "person")
            }
        }
        .bahandiToast()
    }

    private func tab<V: View>(_ view: V, _ titleKey: String, _ icon: String) -> some View {
        NavigationStack { view }
            .tabItem { Label(settings.t(titleKey), systemImage: icon) }
    }
}
