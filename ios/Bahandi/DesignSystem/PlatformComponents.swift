import SwiftUI

struct PlatformScreen<Content: View>: View {
    let title: String
    var subtitle: String?
    let content: Content

    init(_ title: String, subtitle: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title; self.subtitle = subtitle; self.content = content()
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(title).font(.largeTitle.bold()).foregroundStyle(AppColor.text)
                    if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(AppColor.muted) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                content
            }
            .padding(.horizontal, 16).padding(.vertical, 20)
        }
        .background(AppColor.bg.ignoresSafeArea())
        .accessibilityIdentifier("platform.screen.\(title)")
    }
}

struct PlatformCard<Content: View>: View {
    var tint: Color? = nil
    let content: Content
    init(tint: Color? = nil, @ViewBuilder content: () -> Content) { self.tint = tint; self.content = content() }
    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(tint ?? AppColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(AppColor.line))
    }
}

struct PlatformSectionTitle: View {
    let title: String
    var action: (() -> Void)?
    var actionTitle = "Все"
    var body: some View {
        HStack {
            Text(title).font(.title3.bold()).foregroundStyle(AppColor.text)
            Spacer()
            if let action { Button(actionTitle, action: action).font(.subheadline.bold()).buttonStyle(.plain).foregroundStyle(AppColor.green).frame(minHeight: 44) }
        }
    }
}

struct PlatformPrimaryButton: View {
    let title: String
    var icon: String?
    var loading = false
    var disabled = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                if loading { ProgressView().tint(.white) }
                else if let icon { Image(systemName: icon) }
                Text(title).font(.headline)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
        }
        .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: 16))
        .tint(AppColor.green).disabled(disabled || loading)
    }
}

struct MetricTile: View {
    let icon: String
    let value: String
    let label: String
    var tone = AppColor.green
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon).font(.title3).foregroundStyle(tone)
            Text(value).font(.title2.bold()).monospacedDigit().foregroundStyle(AppColor.text)
            Text(label).font(.caption).foregroundStyle(AppColor.muted).lineLimit(2)
        }
        .frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
        .padding(14).background(AppColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(AppColor.line))
        .accessibilityElement(children: .combine)
    }
}

struct PlatformLoadingView: View {
    var body: some View { VStack(spacing: 12) { ProgressView(); Text("Загружаем данные…").font(.subheadline).foregroundStyle(AppColor.muted) }.frame(maxWidth: .infinity, minHeight: 320) }
}

struct PlatformErrorView: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        ContentUnavailableView {
            Label("Не удалось загрузить", systemImage: "wifi.exclamationmark")
        } description: { Text(message) } actions: { Button("Повторить", action: retry).buttonStyle(.borderedProminent).tint(AppColor.green) }
    }
}

extension View {
    func platformNavigationStyle() -> some View {
        navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(AppColor.surface, for: .navigationBar)
    }
}
