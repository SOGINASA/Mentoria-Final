import SwiftUI

enum BioPhase { case scanning, success, error }

// Анимированный отпечаток: пульс + бегущая линия сканирования + рябь, успех — галочка.
struct FingerprintView: View {
    var phase: BioPhase
    var size: CGFloat = 140

    @State private var pulse = false
    @State private var scan = false
    @State private var ripple = false

    private var tint: Color { phase == .error ? AppColor.red : AppColor.green }
    private var bg: Color { phase == .error ? AppColor.redTint : AppColor.greenTint }
    private var symbolFont: Font { .system(size: size * 0.46, weight: .regular) }
    private var travel: CGFloat { size * 0.2 }

    var body: some View {
        ZStack {
            Circle().fill(bg)

            if phase == .scanning {
                Circle().stroke(AppColor.green, lineWidth: 2)
                    .scaleEffect(ripple ? 1.25 : 0.75)
                    .opacity(ripple ? 0 : 0.5)
                Circle().stroke(AppColor.green, lineWidth: 2)
                    .scaleEffect(ripple ? 1.1 : 0.75)
                    .opacity(ripple ? 0 : 0.35)
            }

            if phase == .success {
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.34, weight: .bold))
                    .foregroundColor(AppColor.green)
                    .transition(.scale.combined(with: .opacity))
            } else {
                ZStack {
                    Image(systemName: "touchid")
                        .font(symbolFont)
                        .foregroundColor(tint)
                        .opacity(phase == .scanning ? (pulse ? 1 : 0.5) : 0.85)

                    if phase == .scanning {
                        Rectangle()
                            .fill(LinearGradient(colors: [.clear, AppColor.green, .clear], startPoint: .top, endPoint: .bottom))
                            .frame(height: 16)
                            .shadow(color: AppColor.green.opacity(0.8), radius: 8)
                            .offset(y: scan ? travel : -travel)
                            .mask(Image(systemName: "touchid").font(symbolFont))
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .onAppear { startIfScanning() }
        .onChange(of: phase) { _, _ in startIfScanning() }
    }

    private func startIfScanning() {
        guard phase == .scanning else { return }
        pulse = false; scan = false; ripple = false
        withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) { pulse = true }
        withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true)) { scan = true }
        withAnimation(.easeOut(duration: 1.8).repeatForever(autoreverses: false)) { ripple = true }
    }
}
