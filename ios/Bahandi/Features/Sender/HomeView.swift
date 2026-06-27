import SwiftUI

struct HomeView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var store: WriteOffStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // приветствие
                VStack(alignment: .leading, spacing: 6) {
                    Text(settings.t("greeting")).font(.system(size: 14)).foregroundColor(AppColor.muted)
                    HStack(spacing: 9) {
                        Text(auth.user?.fullName ?? "").font(AppFont.head(26)).foregroundColor(AppColor.text)
                        if let name = auth.user?.store?.name {
                            HStack(spacing: 6) {
                                Image(systemName: "mappin.and.ellipse").font(.system(size: 12))
                                Text(name).font(.system(size: 12.5, weight: .semibold))
                            }
                            .padding(.horizontal, 11).padding(.vertical, 5)
                            .foregroundColor(AppColor.green).background(AppColor.greenTint).clipShape(Capsule())
                        }
                    }
                }

                // счётчики
                HStack(spacing: 10) {
                    counter(store.stats.pending, "st_pending", AppColor.amber)
                    counter(store.stats.approved, "st_approved_s", AppColor.green)
                    counter(store.stats.rejected, "st_rejected_s", AppColor.red)
                }

                // CTA
                NavigationLink { CreateWriteOffView() } label: { createButton }

                // последние
                HStack {
                    Text(settings.t("recent")).font(AppFont.head(16)).foregroundColor(AppColor.text)
                    Spacer()
                    NavigationLink { MyRequestsView() } label: {
                        Text(settings.t("see_all")).font(.system(size: 13, weight: .semibold)).foregroundColor(AppColor.green)
                    }
                }
                .padding(.top, 4)

                if store.listLoading {
                    ProgressView().frame(maxWidth: .infinity).padding(.vertical, 24)
                } else {
                    VStack(spacing: 10) {
                        ForEach(store.list.prefix(5)) { wo in
                            NavigationLink { RequestDetailView(id: wo.id) } label: { RequestRow(wo: wo) }
                                .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(AppColor.bg)
        .navigationTitle(settings.t("nav_home"))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await store.loadStats()
            await store.loadList()
        }
    }

    private func counter(_ value: Int, _ key: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(value)").font(AppFont.head(28)).foregroundColor(color)
            Text(settings.t(key)).font(.system(size: 11.5, weight: .medium)).foregroundColor(AppColor.muted).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .bahandiCard()
    }

    private var createButton: some View {
        HStack(spacing: 16) {
            ZStack { RoundedRectangle(cornerRadius: 15).fill(.white.opacity(0.16)).frame(width: 52, height: 52)
                Image(systemName: "plus").font(.system(size: 26, weight: .bold)).foregroundColor(.white) }
            VStack(alignment: .leading, spacing: 2) {
                Text(settings.t("create_cta")).font(AppFont.head(21)).foregroundColor(.white)
                Text(settings.t("create_cta_sub")).font(.system(size: 13)).foregroundColor(.white.opacity(0.82))
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundColor(.white.opacity(0.7))
        }
        .padding(22)
        .background(LinearGradient(colors: [AppColor.green, AppColor.greenD], startPoint: .topLeading, endPoint: .bottomTrailing))
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }
}
