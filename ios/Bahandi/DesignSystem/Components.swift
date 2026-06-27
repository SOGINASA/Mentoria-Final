import SwiftUI

// MARK: - Логотип BAHANDI
struct BahandiLogo: View {
    enum Size { case sm, md, lg }
    var size: Size = .md

    private var h: CGFloat { size == .lg ? 54 : size == .md ? 34 : 26 }
    private var font: CGFloat { size == .lg ? 30 : size == .md ? 18 : 14 }
    private var bar: CGFloat { size == .lg ? 11 : size == .md ? 7 : 5 }

    var body: some View {
        HStack(spacing: 0) {
            AppColor.orange.frame(width: bar)
            Text("BAHANDI")
                .font(.system(size: font, weight: .bold))
                .tracking(0.6)
                .foregroundColor(.white)
                .padding(.horizontal, size == .lg ? 16 : 9)
            AppColor.orange.frame(width: bar)
        }
        .frame(height: h)
        .background(AppColor.green)
        .clipShape(RoundedRectangle(cornerRadius: size == .lg ? 9 : 6))
        .overlay(RoundedRectangle(cornerRadius: size == .lg ? 9 : 6).stroke(AppColor.text, lineWidth: 2.5))
    }
}

// MARK: - Бейдж статуса
struct StatusBadge: View {
    @EnvironmentObject var settings: AppSettings
    let status: String
    var body: some View {
        let s = statusStyle(status)
        HStack(spacing: 6) {
            Circle().fill(s.fg).frame(width: 6, height: 6)
            Text(settings.t(s.labelKey)).font(.system(size: 11.5, weight: .semibold))
        }
        .padding(.horizontal, 9).padding(.vertical, 4)
        .foregroundColor(s.fg)
        .background(s.bg)
        .clipShape(Capsule())
    }
}

// MARK: - Чип типа списания
struct TypeBadge: View {
    @EnvironmentObject var settings: AppSettings
    let type: String
    var body: some View {
        let hold = type == WType.withDeduction
        Text(settings.t(typeLabelKey(type)))
            .font(.system(size: 11, weight: .semibold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .foregroundColor(hold ? AppColor.orange : AppColor.green)
            .background(hold ? AppColor.orangeTint : AppColor.greenTint)
            .clipShape(RoundedRectangle(cornerRadius: 7))
    }
}

// MARK: - Превью фото
struct PhotoThumb: View {
    let url: String?
    var size: CGFloat = 60
    var radius: CGFloat = 16
    var body: some View {
        ZStack {
            AppColor.surface2
            if let url, let u = URL(string: url) {
                AsyncImage(url: u) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    case .empty: ProgressView()
                    default: Image(systemName: "camera").foregroundColor(AppColor.faint)
                    }
                }
            } else {
                Image(systemName: "camera").font(.system(size: size * 0.34)).foregroundColor(AppColor.faint)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: radius))
        .overlay(RoundedRectangle(cornerRadius: radius).stroke(AppColor.line, lineWidth: 0.5))
    }
}

// MARK: - Аватар-инициалы
struct AvatarCircle: View {
    let name: String?
    var size: CGFloat = 40
    var filled = false
    var body: some View {
        Text(initials(name))
            .font(.system(size: size * 0.36, weight: .semibold))
            .foregroundColor(filled ? .white : AppColor.text)
            .frame(width: size, height: size)
            .background(filled ? AppColor.green : AppColor.surface2)
            .clipShape(Circle())
    }
}

// MARK: - Пустое состояние
struct EmptyStateView: View {
    var icon = "tray"
    let title: String
    var subtitle: String? = nil
    var tone: Color = AppColor.faint
    var toneBg: Color = AppColor.surface2

    var body: some View {
        VStack(spacing: 8) {
            ZStack { Circle().fill(toneBg).frame(width: 80, height: 80)
                Image(systemName: icon).font(.system(size: 32)).foregroundColor(tone) }
            Text(title).font(AppFont.head(18)).foregroundColor(AppColor.text)
            if let subtitle { Text(subtitle).font(.system(size: 13.5)).foregroundColor(AppColor.muted).multilineTextAlignment(.center) }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 56)
    }
}

// MARK: - Тост (оверлей)
struct ToastOverlay: ViewModifier {
    @EnvironmentObject var settings: AppSettings
    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if let toast = settings.toast {
                HStack(spacing: 9) {
                    Image(systemName: "checkmark.circle.fill").foregroundColor(AppColor.green)
                    Text(toast).font(.system(size: 13.5, weight: .medium)).foregroundColor(.white)
                }
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(AppColor.text)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: .black.opacity(0.25), radius: 14, y: 6)
                .padding(.bottom, 28)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.3), value: settings.toast)
    }
}

extension View {
    func bahandiToast() -> some View { modifier(ToastOverlay()) }
}
