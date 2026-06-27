import SwiftUI

struct MyRequestsView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var store: WriteOffStore
    @State private var tab = "all"

    var body: some View {
        VStack(spacing: 0) {
            ChipBar(items: [
                ("all", settings.t("tab_all")),
                (WStatus.pending, settings.t("st_pending")),
                (WStatus.approved, settings.t("st_approved_s")),
                (WStatus.rejected, settings.t("st_rejected_s")),
            ], selection: $tab)
            .padding(.horizontal, 20).padding(.vertical, 12)

            if store.listLoading {
                Spacer(); ProgressView(); Spacer()
            } else if store.list.isEmpty {
                ScrollView { EmptyStateView(icon: "tray", title: settings.t("empty_title"), subtitle: settings.t("empty_sub")) }
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(store.list) { wo in
                            NavigationLink { RequestDetailView(id: wo.id) } label: { RequestRow(wo: wo) }
                                .buttonStyle(.plain)
                        }
                    }
                    .padding(20)
                }
            }
        }
        .background(AppColor.bg)
        .navigationTitle(settings.t("nav_my"))
        .navigationBarTitleDisplayMode(.inline)
        .task(id: tab) { await store.loadList(status: tab == "all" ? nil : tab) }
    }
}
