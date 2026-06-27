import SwiftUI

struct RequestDetailView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var store: WriteOffStore
    let id: Int

    @State private var wo: WriteOff?
    @State private var loading = true

    var body: some View {
        Group {
            if let wo {
                ScrollView {
                    VStack(spacing: 16) {
                        BigPhotoView(photos: wo.photos ?? [])
                        HStack { StatusBadge(status: wo.status); Spacer() }

                        if wo.status == WStatus.rejected, let reason = wo.rejectionReason {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(settings.t("reject_reason")).font(.system(size: 12, weight: .semibold)).foregroundColor(AppColor.red)
                                Text(reason).font(.system(size: 13.5)).foregroundColor(AppColor.text)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(13).background(AppColor.redTint)
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppColor.red, lineWidth: 1))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }

                        InfoCardView(wo: wo)
                        TimelineView(wo: wo)
                    }
                    .padding(20)
                }
                .background(AppColor.bg)
            } else if loading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).background(AppColor.bg)
            } else {
                EmptyStateView(title: settings.t("error_generic")).background(AppColor.bg)
            }
        }
        .navigationTitle(settings.t("nav_my"))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            loading = true
            wo = try? await store.load(id: id)
            loading = false
        }
    }
}
