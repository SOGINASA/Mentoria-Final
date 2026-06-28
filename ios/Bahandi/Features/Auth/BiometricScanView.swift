import SwiftUI

// Полноэкранный вход по биометрии:
// 1) verifyBiometric() — системный Face ID / Touch ID;
// 2) completeLogin()   — вход через бэкенд (/auth/login по кредам из Keychain).
struct BiometricScanView: View {
    @EnvironmentObject var settings: AppSettings
    var enrolled: Bool = true
    let verifyBiometric: () async throws -> Void
    let completeLogin: () async throws -> Void
    let onCancel: () -> Void

    @State private var phase: BioPhase = .scanning
    @State private var task: Task<Void, Never>?

    var body: some View {
        ZStack {
            Rectangle().fill(.ultraThinMaterial).ignoresSafeArea()
            VStack(spacing: 0) {
                FingerprintView(phase: phase, size: 150)

                Text(title).font(AppFont.head(22)).foregroundColor(titleColor).padding(.top, 26)
                if !subtitle.isEmpty {
                    Text(subtitle).font(.system(size: 14)).foregroundColor(AppColor.muted)
                        .multilineTextAlignment(.center).padding(.top, 6).padding(.horizontal, 40)
                }

                if phase == .error {
                    VStack(spacing: 10) {
                        if enrolled {
                            Button { run() } label: {
                                Text(settings.t("bio_retry")).font(AppFont.head(16)).foregroundColor(.white)
                                    .frame(maxWidth: .infinity).frame(height: 50).background(AppColor.green)
                                    .clipShape(RoundedRectangle(cornerRadius: 14))
                            }
                        }
                        Button(action: onCancel) {
                            Text(settings.t("bio_use_pass")).font(.system(size: 14, weight: .semibold)).foregroundColor(AppColor.text)
                                .frame(maxWidth: .infinity).frame(height: 50).background(AppColor.surface)
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppColor.line, lineWidth: 1.5))
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                    }
                    .frame(maxWidth: 300).padding(.top, 28)
                } else if phase == .scanning {
                    Button(action: cancel) {
                        Text(settings.t("cancel")).font(.system(size: 13, weight: .semibold)).foregroundColor(AppColor.muted)
                    }
                    .padding(.top, 30)
                }
            }
            .padding(24)
        }
        .onAppear { run() }
        .onDisappear { task?.cancel() }
    }

    private var title: String {
        switch phase {
        case .scanning: return settings.t("bio_scan_title")
        case .success: return settings.t("bio_success")
        case .error: return settings.t(enrolled ? "bio_error" : "bio_not_set")
        }
    }
    private var subtitle: String {
        switch phase {
        case .scanning: return settings.t("bio_scan_sub")
        case .error: return settings.t(enrolled ? "bio_error_sub" : "bio_not_set_sub")
        case .success: return ""
        }
    }
    private var titleColor: Color {
        switch phase {
        case .success: return AppColor.green
        case .error: return AppColor.red
        case .scanning: return AppColor.text
        }
    }

    private func run() {
        task?.cancel()
        guard enrolled else { phase = .error; return }
        phase = .scanning
        task = Task {
            do {
                try await verifyBiometric() // системный Face ID / Touch ID
            } catch is BiometricCancelled {
                onCancel(); return
            } catch {
                if !Task.isCancelled { withAnimation { phase = .error } }
                return
            }
            if Task.isCancelled { return }
            withAnimation(.spring(duration: 0.35)) { phase = .success }
            try? await Task.sleep(nanoseconds: 800_000_000)
            if Task.isCancelled { return }
            do {
                try await completeLogin() // вход через бэкенд → auth.status флипается
            } catch {
                if !Task.isCancelled { withAnimation { phase = .error } }
            }
        }
    }

    private func cancel() {
        task?.cancel()
        onCancel()
    }
}
