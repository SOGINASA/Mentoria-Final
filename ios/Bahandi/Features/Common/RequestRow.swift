import SwiftUI

struct RequestRow: View {
    @EnvironmentObject var settings: AppSettings
    let wo: WriteOff
    var showAuthor = false

    var body: some View {
        let date = dateLabel(wo.createdAt, lang: settings.lang)
        let title = showAuthor ? (wo.author?.fullName ?? "—") : settings.t(typeLabelKey(wo.type))
        let sub = showAuthor ? "\(wo.store?.name ?? "—") · \(date)" : (wo.store?.name ?? "—")

        HStack(spacing: 13) {
            PhotoThumb(url: wo.photos?.first?.url, size: 60)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 14.5, weight: .semibold)).foregroundColor(AppColor.text).lineLimit(1)
                Text(sub).font(.system(size: 12.5)).foregroundColor(AppColor.muted).lineLimit(1)
                if !showAuthor {
                    Text(date).font(.system(size: 11.5)).foregroundColor(AppColor.faint)
                }
            }
            Spacer(minLength: 4)
            StatusBadge(status: wo.status)
        }
        .padding(12)
        .background(AppColor.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(AppColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
