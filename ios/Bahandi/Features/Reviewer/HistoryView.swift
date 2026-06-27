import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var store: WriteOffStore
    @State private var tab = "all"

    private var items: [WriteOff] {
        tab == "all" ? store.list.filter { $0.status != WStatus.pending } : store.list
    }

    var body: some View {
        VStack(spacing: 0) {
            ChipBar(items: [
                ("all", settings.t("tab_all")),
                (WStatus.approved, settings.t("st_approved_s")),
                (WStatus.rejected, settings.t("st_rejected_s")),
            ], selection: $tab)
            .padding(.horizontal, 20).padding(.vertical, 12)

            if store.listLoading {
                Spacer(); ProgressView(); Spacer()
            } else if items.isEmpty {
                ScrollView { EmptyStateView(icon: "clock", title: settings.t("empty_title"), subtitle: settings.t("queue_empty_sub")) }
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(items) { wo in
                            NavigationLink { ReviewDetailView(id: wo.id) } label: { RequestRow(wo: wo, showAuthor: true) }.buttonStyle(.plain)
                        }
                    }
                    .padding(20)
                }
            }
        }
        .background(AppColor.bg)
        .navigationTitle(settings.t("nav_history"))
        .navigationBarTitleDisplayMode(.inline)
        .task(id: tab) { await store.loadList(status: tab == "all" ? nil : tab) }
    }
}
