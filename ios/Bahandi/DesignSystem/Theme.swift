import SwiftUI

// MARK: - Цветовые токены Bahandi (динамические: светлая / тёмная тема)
// Значения 1:1 с веб-версией (front/src/index.css).
enum AppColor {
    static let bg        = dyn(light: 0xeceee8, dark: 0x0e120d)
    static let surface   = dyn(light: 0xffffff, dark: 0x181d15)
    static let surface2  = dyn(light: 0xf5f6f1, dark: 0x1f261c)
    static let text      = dyn(light: 0x1a1c15, dark: 0xedf0e8)
    static let muted     = dyn(light: 0x71756b, dark: 0x9aa492)
    static let faint     = dyn(light: 0xa3a79b, dark: 0x69745f)
    static let line      = dyn(light: 0xe5e8df, dark: 0x2a3225)
    static let line2     = dyn(light: 0xeef0ea, dark: 0x222a1e)
    static let green     = dyn(light: 0x0a6730, dark: 0x46b06f)
    static let greenD    = dyn(light: 0x085026, dark: 0x3a9c60)
    static let greenTint = dyn(light: 0xe6f0e9, dark: 0x15281b)
    static let orange    = dyn(light: 0xea5e1f, dark: 0xf47a3f)
    static let orangeTint = dyn(light: 0xfceee5, dark: 0x2c1c12)
    static let amber     = dyn(light: 0xc9820a, dark: 0xe3aa48)
    static let amberTint = dyn(light: 0xf8eed6, dark: 0x2a2310)
    static let red       = dyn(light: 0xcf3b2e, dark: 0xe76152)
    static let redTint   = dyn(light: 0xfbe7e4, dark: 0x2c1714)

    private static func dyn(light: Int, dark: Int) -> Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }
}

// MARK: - Типографика (нативные SF-шрифты под iOS, акценты — как в макете)
enum AppFont {
    static func head(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .default)
    }
    static func body(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
}

// MARK: - Хелперы
extension UIColor {
    convenience init(hex: Int, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: alpha
        )
    }
}

extension View {
    /// Карточка в фирменном стиле (поверхность + рамка + скругление).
    func bahandiCard(padding: CGFloat = 14, radius: CGFloat = 16) -> some View {
        self
            .padding(padding)
            .background(AppColor.surface)
            .overlay(RoundedRectangle(cornerRadius: radius).stroke(AppColor.line, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: radius))
    }
}
