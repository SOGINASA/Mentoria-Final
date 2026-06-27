import SwiftUI

struct ReviewDetailView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var store: WriteOffStore
    @Environment(\.dismiss) private var dismiss
    let id: Int

    @State private var wo: WriteOff?
    @State private var loading = true
    @State private var showApprove = false
    @State private var showReject = false
    @State private var reason = ""

    var body: some View {
        Group {
            if let wo {
                ScrollView {
                    VStack(spacing: 14) {
                        BigPhotoView(photos: wo.photos ?? [])

                        HStack(spacing: 11) {
                            AvatarCircle(name: wo.author?.fullName, size: 42, filled: true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(wo.author?.fullName ?? "—").font(.system(size: 15, weight: .semibold)).foregroundColor(AppColor.text)
                                Text("\(settings.t("author_label")) · \(dateLabel(wo.createdAt, lang: settings.lang))").font(.system(size: 12)).foregroundColor(AppColor.muted)
                            }
                            Spacer()
                        }

                        InfoCardView(wo: wo, typeAsBadge: true)

                        if wo.iikoSyncStatus == IikoStatus.synced {
                            HStack(spacing: 11) {
                                Image(systemName: "checkmark.shield.fill").foregroundColor(AppColor.green)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(settings.t("iiko_done")).font(.system(size: 13, weight: .semibold)).foregroundColor(AppColor.green)
                                    Text(wo.iikoActId ?? settings.t("iiko_done_sub")).font(.system(size: 11.5)).foregroundColor(AppColor.muted)
                                }
                                Spacer()
                            }
                            .padding(13).background(AppColor.greenTint)
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppColor.green, lineWidth: 1))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                    }
                    .padding(20)
                }
                .background(AppColor.bg)
                .safeAreaInset(edge: .bottom) { if wo.status == WStatus.pending { actionBar } }
            } else if loading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).background(AppColor.bg)
            } else {
                EmptyStateView(title: settings.t("error_generic")).background(AppColor.bg)
            }
        }
        .navigationTitle(settings.t("nav_queue"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .confirmationDialog(settings.t("approve_title"), isPresented: $showApprove, titleVisibility: .visible) {
            Button(settings.t("approve")) { Task { await approve() } }
            Button(settings.t("cancel"), role: .cancel) {}
        } message: { Text(settings.t("iiko_will")) }
        .sheet(isPresented: $showReject) { rejectSheet }
    }

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button { reason = ""; showReject = true } label: {
                Label(settings.t("reject"), systemImage: "xmark").font(AppFont.head(17))
                    .frame(maxWidth: .infinity).frame(height: 54).foregroundColor(AppColor.red).background(AppColor.redTint)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppColor.red, lineWidth: 1.5)).clipShape(RoundedRectangle(cornerRadius: 14))
            }
            Button { showApprove = true } label: {
                Label(settings.t("approve"), systemImage: "checkmark").font(AppFont.head(17))
                    .frame(maxWidth: .infinity).frame(height: 54).foregroundColor(.white).background(AppColor.green)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(AppColor.surface.ignoresSafeArea(edges: .bottom))
        .overlay(Rectangle().fill(AppColor.line).frame(height: 1), alignment: .top)
    }

    private var rejectSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                ZStack { RoundedRectangle(cornerRadius: 13).fill(AppColor.redTint).frame(width: 46, height: 46)
                    Image(systemName: "xmark").font(.system(size: 20, weight: .semibold)).foregroundColor(AppColor.red) }
                VStack(alignment: .leading, spacing: 2) {
                    Text(settings.t("reject_title")).font(AppFont.head(20)).foregroundColor(AppColor.text)
                    Text(settings.t("reject_body")).font(.system(size: 12.5)).foregroundColor(AppColor.muted)
                }
            }
            TextEditor(text: $reason).frame(minHeight: 100).scrollContentBackground(.hidden).font(.system(size: 14))
                .padding(10).background(AppColor.surface2)
                .overlay(RoundedRectangle(cornerRadius: 13).stroke(reason.trimmingCharacters(in: .whitespaces).count >= 5 ? AppColor.red : AppColor.line, lineWidth: 1.5))
                .clipShape(RoundedRectangle(cornerRadius: 13))
                .overlay(alignment: .topLeading) { if reason.isEmpty { Text(settings.t("reject_ph")).font(.system(size: 14)).foregroundColor(AppColor.faint).padding(.top, 18).padding(.leading, 15).allowsHitTesting(false) } }
            HStack(spacing: 11) {
                Button(settings.t("cancel")) { showReject = false }
                    .frame(maxWidth: .infinity).frame(height: 50).foregroundColor(AppColor.text).background(AppColor.surface)
                    .overlay(RoundedRectangle(cornerRadius: 13).stroke(AppColor.line, lineWidth: 1.5)).clipShape(RoundedRectangle(cornerRadius: 13))
                Button { Task { await reject() } } label: {
                    Text(settings.t("reject")).font(AppFont.head(16)).frame(maxWidth: .infinity).frame(height: 50)
                        .foregroundColor(.white).background(reason.trimmingCharacters(in: .whitespaces).count >= 5 ? AppColor.red : AppColor.line)
                        .clipShape(RoundedRectangle(cornerRadius: 13))
                }
                .disabled(reason.trimmingCharacters(in: .whitespaces).count < 5)
            }
        }
        .padding(22)
        .presentationDetents([.height(320)])
    }

    private func reload() async {
        loading = true
        wo = try? await store.load(id: id)
        loading = false
    }
    private func approve() async {
        do { _ = try await store.approve(id); settings.showToast(settings.t("approved_toast")); await store.loadStats(); dismiss() }
        catch { settings.showToast((error as? APIError)?.message ?? settings.t("error_generic")) }
    }
    private func reject() async {
        let r = reason.trimmingCharacters(in: .whitespaces)
        guard r.count >= 5 else { return }
        do { _ = try await store.reject(id, reason: r); showReject = false; settings.showToast(settings.t("rejected_toast")); await store.loadStats(); dismiss() }
        catch { settings.showToast((error as? APIError)?.message ?? settings.t("error_generic")) }
    }
}
