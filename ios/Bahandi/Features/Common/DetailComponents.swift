import SwiftUI

// MARK: - Крупное фото + миниатюры + полноэкранный просмотр
struct BigPhotoView: View {
    let photos: [Photo]
    @State private var index = 0
    @State private var full = false

    private var urls: [String] { photos.map(\.url) }

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                AppColor.surface2
                if index < urls.count, let u = URL(string: urls[index]) {
                    AsyncImage(url: u) { img in img.resizable().scaledToFill() } placeholder: { ProgressView() }
                } else {
                    Image(systemName: "camera").font(.system(size: 56)).foregroundColor(AppColor.faint)
                }
            }
            .aspectRatio(4.0/3.0, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(AppColor.line, lineWidth: 1))
            .onTapGesture { if !urls.isEmpty { full = true } }

            if urls.count > 1 {
                HStack(spacing: 8) {
                    ForEach(Array(urls.enumerated()), id: \.offset) { i, u in
                        AsyncImage(url: URL(string: u)) { img in img.resizable().scaledToFill() } placeholder: { AppColor.surface2 }
                            .frame(width: 56, height: 56)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(i == index ? AppColor.green : .clear, lineWidth: 2))
                            .onTapGesture { index = i }
                    }
                    Spacer()
                }
            }
        }
        .fullScreenCover(isPresented: $full) {
            ZStack {
                Color.black.ignoresSafeArea()
                if index < urls.count { AsyncImage(url: URL(string: urls[index])) { img in img.resizable().scaledToFit() } placeholder: { ProgressView().tint(.white) } }
                VStack { HStack { Spacer(); Button { full = false } label: { Image(systemName: "xmark.circle.fill").font(.system(size: 30)).foregroundColor(.white.opacity(0.8)) } }; Spacer() }.padding()
            }
        }
    }
}

// MARK: - Карточка с данными заявки
struct InfoCardView: View {
    @EnvironmentObject var settings: AppSettings
    let wo: WriteOff
    var typeAsBadge = false

    var body: some View {
        VStack(spacing: 0) {
            row(settings.t("f_point"), value: wo.store?.name ?? "—")
            Divider().background(AppColor.line2)
            HStack {
                Text(settings.t("f_type")).font(.system(size: 13)).foregroundColor(AppColor.muted)
                Spacer()
                if typeAsBadge { TypeBadge(type: wo.type) }
                else { Text(settings.t(typeLabelKey(wo.type))).font(.system(size: 13, weight: .semibold)).foregroundColor(AppColor.text) }
            }
            .padding(.horizontal, 15).padding(.vertical, 13)
            if let emp = wo.deductionEmployee {
                Divider().background(AppColor.line2)
                row(settings.t("f_emp"), value: emp.fullName)
            }
            Divider().background(AppColor.line2)
            VStack(alignment: .leading, spacing: 5) {
                Text(settings.t("f_comment")).font(.system(size: 13)).foregroundColor(AppColor.muted)
                Text(wo.comment).font(.system(size: 13.5)).foregroundColor(AppColor.text)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15)
        }
        .background(AppColor.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(AppColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func row(_ label: String, value: String) -> some View {
        HStack {
            Text(label).font(.system(size: 13)).foregroundColor(AppColor.muted)
            Spacer()
            Text(value).font(.system(size: 13, weight: .semibold)).foregroundColor(AppColor.text).multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 15).padding(.vertical, 13)
    }
}

// MARK: - Таймлайн заявки
struct TimelineView: View {
    @EnvironmentObject var settings: AppSettings
    let wo: WriteOff

    private struct Item { let title: String; let sub: String; let color: Color }

    private var items: [Item] {
        var r: [Item] = [
            Item(title: settings.t("tl_created"), sub: dateLabel(wo.createdAt, lang: settings.lang), color: AppColor.green),
            Item(title: settings.t("tl_review"), sub: wo.store?.name ?? "", color: AppColor.green),
        ]
        switch wo.status {
        case WStatus.pending: r.append(Item(title: settings.t("tl_pending"), sub: "", color: AppColor.amber))
        case WStatus.approved:
            r.append(Item(title: settings.t("tl_approved"), sub: wo.reviewer?.fullName ?? "", color: AppColor.green))
            if wo.iikoSyncStatus == IikoStatus.synced {
                r.append(Item(title: settings.t("tl_iiko"), sub: wo.iikoActId ?? "iiko", color: AppColor.green))
            }
        case WStatus.rejected: r.append(Item(title: settings.t("tl_rejected"), sub: wo.reviewer?.fullName ?? "", color: AppColor.red))
        default: break
        }
        return r
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(settings.t("timeline")).font(.system(size: 12, weight: .semibold)).foregroundColor(AppColor.faint)
                .textCase(.uppercase).padding(.bottom, 14)
            ForEach(Array(items.enumerated()), id: \.offset) { i, it in
                HStack(alignment: .top, spacing: 14) {
                    VStack(spacing: 0) {
                        Circle().fill(it.color).frame(width: 13, height: 13)
                            .overlay(Circle().stroke(it.color.opacity(0.25), lineWidth: 3))
                        if i < items.count - 1 { Rectangle().fill(AppColor.line).frame(width: 2).frame(maxHeight: .infinity) }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(it.title).font(.system(size: 13.5, weight: .semibold)).foregroundColor(AppColor.text)
                        if !it.sub.isEmpty { Text(it.sub).font(.system(size: 12)).foregroundColor(AppColor.muted) }
                    }
                    .padding(.bottom, 16)
                    Spacer()
                }
            }
        }
        .padding(16)
        .background(AppColor.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(AppColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
