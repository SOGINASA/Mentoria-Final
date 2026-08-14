import SwiftUI

@main
struct BahandiApp: App {
    @StateObject private var settings = AppSettings()
    @StateObject private var auth = AuthStore()
    @StateObject private var writeOffs = WriteOffStore()
    @StateObject private var platform = PlatformStore()

    init() {
        if ProcessInfo.processInfo.arguments.contains("-ui-testing-reset-session") {
            TokenStore.clear()
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
                .environmentObject(auth)
                .environmentObject(writeOffs)
                .environmentObject(platform)
                .tint(AppColor.green)
                .preferredColorScheme(settings.colorScheme)
                .task { await auth.restoreSession() }
        }
    }
}
