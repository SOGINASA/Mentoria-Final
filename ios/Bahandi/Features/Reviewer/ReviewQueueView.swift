import SwiftUI

struct ReviewQueueView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var store: WriteOffStore
    @State private var tab = WStatus.pending

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text(settings.t("queue_count")).font(.system(size: 13.5)).foregroundColor(AppColor.muted)
                Text("\(store.stats.pending)").font(AppFont.head(14)).foregroundColor(.white)
                    .padding(.horizontal, 8).frame(minWidth: 26, minHeight: 26).background(AppColor.orange).clipShape(Capsule())
                Spacer()
            }
            .padding(.horizontal, 20).padding(.top, 12)

            ChipBar(items: [(WStatus.pending, settings.t("st_pending")), ("all", settings.t("tab_all"))], selection: $tab)
                .padding(.horizontal, 20).padding(.vertical, 12)

            if store.listLoading {
                Spacer(); ProgressView(); Spacer()
            } else if store.list.isEmpty {
                ScrollView { EmptyStateView(icon: "checkmark.circle", title: settings.t("queue_empty"), subtitle: settings.t("queue_empty_sub"), tone: AppColor.green, toneBg: AppColor.greenTint) }
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(store.list) { wo in
                            NavigationLink { ReviewDetailView(id: wo.id) } label: { queueRow(wo) }.buttonStyle(.plain)
                        }
                    }
                    .padding(20)
                }
            }
        }
        .background(AppColor.bg)
        .navigationTitle(settings.t("nav_queue"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.loadStats() }
        .task(id: tab) { await store.loadList(status: WStatus.pending) }
    }

    private func queueRow(_ wo: WriteOff) -> some View {
        HStack(spacing: 13) {
            PhotoThumb(url: wo.photos?.first?.url, size: 66, radius: 17)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 7) {
                    AvatarCircle(name: wo.author?.fullName, size: 22)
                    Text(wo.author?.fullName ?? "—").font(.system(size: 13, weight: .semibold)).foregroundColor(AppColor.text).lineLimit(1)
                }
                Text(wo.store?.name ?? "—").font(.system(size: 12.5)).foregroundColor(AppColor.muted).lineLimit(1)
                HStack(spacing: 7) {
                    TypeBadge(type: wo.type)
                    Text(dateLabel(wo.createdAt, lang: settings.lang)).font(.system(size: 11.5)).foregroundColor(AppColor.faint)
                }
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.right").foregroundColor(AppColor.faint)
        }
        .padding(13)
        .background(AppColor.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(AppColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
