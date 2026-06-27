import SwiftUI

@main
struct BahandiApp: App {
    @StateObject private var settings = AppSettings()
    @StateObject private var auth = AuthStore()
    @StateObject private var writeOffs = WriteOffStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
                .environmentObject(auth)
                .environmentObject(writeOffs)
                .tint(AppColor.green)
                .preferredColorScheme(settings.colorScheme)
                .task { await auth.restoreSession() }
        }
    }
}
