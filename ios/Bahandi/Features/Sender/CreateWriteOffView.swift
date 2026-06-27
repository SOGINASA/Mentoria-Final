import SwiftUI
import PhotosUI

struct CreateWriteOffView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var store: WriteOffStore
    @Environment(\.dismiss) private var dismiss

    // Загруженное фото + результат распознавания ИИ
    struct UploadedPhoto: Identifiable { var id: String { url }; let url: String; let recognition: Recognition? }

    @State private var stepIndex = 0
    @State private var photos: [UploadedPhoto] = []
    @State private var uploading = false
    @State private var storeId: Int?
    @State private var wtype = ""
    @State private var employeeId: Int?
    @State private var comment = ""
    @State private var empQuery = ""
    @State private var error: String?

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false

    private let minComment = 10
    private let maxPhotos = 4

    private var steps: [String] {
        var s = ["photo", "point", "type"]
        if wtype == WType.withDeduction { s.append("employee") }
        s.append("comment")
        return s
    }
    private var cur: String { steps[min(stepIndex, steps.count - 1)] }
    private var isLast: Bool { stepIndex >= steps.count - 1 }
    private var commentLen: Int { comment.trimmingCharacters(in: .whitespacesAndNewlines).count }

    private var valid: Bool {
        switch cur {
        case "photo": return !photos.isEmpty
        case "point": return storeId != nil
        case "type": return !wtype.isEmpty
        case "employee": return employeeId != nil
        case "comment": return commentLen >= minComment
        default: return false
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // прогресс
                HStack(spacing: 6) {
                    ForEach(Array(steps.enumerated()), id: \.offset) { i, _ in
                        Capsule().fill(i <= stepIndex ? AppColor.green : AppColor.line).frame(height: 6)
                    }
                }
                .padding(.bottom, 20)

                Text("\(settings.t("step")) \(stepIndex + 1) / \(steps.count)")
                    .font(.system(size: 12.5, weight: .semibold)).foregroundColor(AppColor.green)
                Text(settings.t("step_" + cur)).font(AppFont.head(23)).foregroundColor(AppColor.text).padding(.top, 4)
                Text(settings.t("step_\(cur)_h")).font(.system(size: 13.5)).foregroundColor(AppColor.muted).padding(.top, 4).padding(.bottom, 20)

                if let error {
                    Text(error).font(.system(size: 13, weight: .medium)).foregroundColor(AppColor.red)
                        .padding(12).frame(maxWidth: .infinity, alignment: .leading).background(AppColor.redTint)
                        .clipShape(RoundedRectangle(cornerRadius: 12)).padding(.bottom, 12)
                }

                stepContent
            }
            .padding(20)
        }
        .background(AppColor.bg)
        .navigationTitle(settings.t("create_cta"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) { footer }
        .sheet(isPresented: $showCamera) {
            CameraPicker { image in if let data = image.jpegData(compressionQuality: 0.8) { Task { await upload(data) } } }
                .ignoresSafeArea()
        }
        .onChange(of: pickerItems) { _, items in
            Task {
                for item in items {
                    if photos.count >= maxPhotos { break }
                    if let data = try? await item.loadTransferable(type: Data.self) { await upload(data) }
                }
                pickerItems = []
            }
        }
        .task {
            await store.loadStores()
            if storeId == nil { storeId = auth.user?.storeId }
        }
        .task(id: wtype) {
            if wtype == WType.withDeduction { await store.loadEmployees(storeId: storeId) }
        }
    }

    // MARK: контент шага
    @ViewBuilder private var stepContent: some View {
        switch cur {
        case "photo": photoStep
        case "point": pointStep
        case "type": typeStep
        case "employee": employeeStep
        default: commentStep
        }
    }

    // Сводный вердикт ИИ по всем фото: «плохие» позиции вперёд.
    private var aiItems: [DetectedItem] {
        photos.flatMap { $0.recognition?.detectedItems ?? [] }
            .sorted { ($0.requiresWriteoff ? 1 : 0, $0.confidence) > ($1.requiresWriteoff ? 1 : 0, $1.confidence) }
    }
    private var aiNeedsWriteoff: Bool { aiItems.contains { $0.requiresWriteoff } }

    private var photoStep: some View {
        VStack(spacing: 14) {
            let cols = [GridItem(.adaptive(minimum: 104), spacing: 11)]
            LazyVGrid(columns: cols, spacing: 11) {
                ForEach(photos) { p in
                    ZStack(alignment: .topTrailing) {
                        PhotoThumb(url: p.url, size: 104, radius: 18)
                        Button { photos.removeAll { $0.id == p.id } } label: {
                            Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundColor(.white)
                                .padding(6).background(.black.opacity(0.5)).clipShape(Circle())
                        }
                        .padding(6)
                    }
                }
                if photos.count < maxPhotos {
                    PhotosPicker(selection: $pickerItems, maxSelectionCount: maxPhotos - photos.count, matching: .images) {
                        VStack(spacing: 6) {
                            if uploading { ProgressView() } else { Image(systemName: "camera").font(.system(size: 24)) }
                            Text(settings.t("from_gallery")).font(.system(size: 11.5, weight: .semibold))
                        }
                        .foregroundColor(AppColor.green).frame(width: 104, height: 104)
                        .background(AppColor.surface)
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(AppColor.line, style: StrokeStyle(lineWidth: 2, dash: [5])))
                    }
                }
            }
            HStack(spacing: 11) {
                Button { showCamera = true } label: {
                    Label(settings.t("take_photo"), systemImage: "camera.fill").font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity).frame(height: 50).foregroundColor(.white).background(AppColor.green)
                        .clipShape(RoundedRectangle(cornerRadius: 13))
                }
                PhotosPicker(selection: $pickerItems, maxSelectionCount: maxPhotos - photos.count, matching: .images) {
                    Label(settings.t("from_gallery"), systemImage: "photo").font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity).frame(height: 50).foregroundColor(AppColor.text).background(AppColor.surface)
                        .overlay(RoundedRectangle(cornerRadius: 13).stroke(AppColor.line, lineWidth: 1.5))
                        .clipShape(RoundedRectangle(cornerRadius: 13))
                }
                .disabled(photos.count >= maxPhotos)
            }

            // Вердикт ИИ (распознавание порчи на фото)
            if !aiItems.isEmpty {
                AiVerdictView(items: aiItems, needsWriteoff: aiNeedsWriteoff)
            }
        }
    }

    private var pointStep: some View {
        VStack(spacing: 10) {
            ForEach(store.stores) { s in
                selectRow(icon: "building.2", title: s.name, selected: storeId == s.id) { storeId = s.id }
            }
        }
    }

    private var typeStep: some View {
        VStack(spacing: 12) {
            typeCard(WType.noDeduction, icon: "checkmark.shield", tint: AppColor.greenTint, fg: AppColor.green)
            typeCard(WType.withDeduction, icon: "person.badge.minus", tint: AppColor.orangeTint, fg: AppColor.orange)
        }
    }

    private var employeeStep: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundColor(AppColor.faint)
                TextField(settings.t("search_emp"), text: $empQuery)
            }
            .font(.system(size: 14)).padding(.horizontal, 14).frame(height: 48)
            .background(AppColor.surface).overlay(RoundedRectangle(cornerRadius: 13).stroke(AppColor.line, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 13))

            ForEach(store.employees.filter { empQuery.isEmpty || $0.fullName.localizedCaseInsensitiveContains(empQuery) }) { e in
                HStack(spacing: 13) {
                    AvatarCircle(name: e.fullName, size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(e.fullName).font(.system(size: 14.5, weight: .semibold)).foregroundColor(AppColor.text)
                        if let p = e.position { Text(p).font(.system(size: 12)).foregroundColor(AppColor.muted) }
                    }
                    Spacer()
                    if employeeId == e.id { checkDot }
                }
                .padding(13)
                .background(AppColor.surface)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(employeeId == e.id ? AppColor.green : AppColor.line, lineWidth: 1.5))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .onTapGesture { employeeId = e.id }
            }
        }
    }

    private var commentStep: some View {
        VStack(spacing: 16) {
            VStack(spacing: 8) {
                TextEditor(text: $comment)
                    .frame(minHeight: 120).scrollContentBackground(.hidden)
                    .font(.system(size: 15)).foregroundColor(AppColor.text)
                    .overlay(alignment: .topLeading) {
                        if comment.isEmpty { Text(settings.t("comment_ph")).font(.system(size: 15)).foregroundColor(AppColor.faint).padding(.top, 8).padding(.leading, 5).allowsHitTesting(false) }
                    }
                Divider().background(AppColor.line2)
                HStack {
                    Text(commentLen >= minComment ? settings.t("comment_ok") : settings.t("comment_need"))
                        .font(.system(size: 12, weight: .medium)).foregroundColor(commentLen >= minComment ? AppColor.green : AppColor.muted)
                    Spacer()
                    Text("\(commentLen) / \(minComment)").font(.system(size: 12)).foregroundColor(AppColor.faint).monospacedDigit()
                }
            }
            .bahandiCard()

            VStack(alignment: .leading, spacing: 9) {
                Text(settings.t("summary")).font(.system(size: 12, weight: .semibold)).foregroundColor(AppColor.faint).textCase(.uppercase)
                summaryRow(settings.t("f_point"), store.stores.first { $0.id == storeId }?.name ?? "—")
                summaryRow(settings.t("f_type"), settings.t(typeLabelKey(wtype)))
                if wtype == WType.withDeduction { summaryRow(settings.t("f_emp"), store.employees.first { $0.id == employeeId }?.fullName ?? "—") }
                summaryRow(settings.t("f_photos"), "\(photos.count)")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15).background(AppColor.surface2).clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: футер
    private var footer: some View {
        HStack(spacing: 11) {
            Button { prev() } label: {
                Image(systemName: "chevron.left").font(.system(size: 18, weight: .semibold)).foregroundColor(AppColor.text)
                    .frame(width: 54, height: 52).background(AppColor.surface)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppColor.line, lineWidth: 1.5)).clipShape(RoundedRectangle(cornerRadius: 14))
            }
            Button { next() } label: {
                HStack(spacing: 9) {
                    if store.acting { ProgressView().tint(.white) }
                    else {
                        Text(isLast ? settings.t("submit") : settings.t("next")).font(AppFont.head(17))
                        if !isLast { Image(systemName: "chevron.right").font(.system(size: 15, weight: .bold)) }
                    }
                }
                .frame(maxWidth: .infinity).frame(height: 52)
                .foregroundColor(valid ? .white : AppColor.faint).background(valid ? AppColor.green : AppColor.line)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .disabled(!valid || store.acting)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(AppColor.surface.ignoresSafeArea(edges: .bottom))
        .overlay(Rectangle().fill(AppColor.line).frame(height: 1), alignment: .top)
    }

    // MARK: вспомогательные вьюхи
    private func selectRow(icon: String, title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        HStack(spacing: 13) {
            ZStack { RoundedRectangle(cornerRadius: 11).fill(selected ? AppColor.greenTint : AppColor.surface2).frame(width: 42, height: 42)
                Image(systemName: icon).foregroundColor(selected ? AppColor.green : AppColor.faint) }
            Text(title).font(.system(size: 14.5, weight: .semibold)).foregroundColor(AppColor.text)
            Spacer()
            if selected { checkDot }
        }
        .padding(15).background(AppColor.surface)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? AppColor.green : AppColor.line, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .onTapGesture(perform: action)
    }

    private func typeCard(_ type: String, icon: String, tint: Color, fg: Color) -> some View {
        let active = wtype == type
        return HStack(alignment: .top, spacing: 14) {
            ZStack { RoundedRectangle(cornerRadius: 13).fill(tint).frame(width: 46, height: 46)
                Image(systemName: icon).font(.system(size: 20)).foregroundColor(fg) }
            VStack(alignment: .leading, spacing: 3) {
                Text(settings.t(typeLabelKey(type))).font(AppFont.head(17)).foregroundColor(AppColor.text)
                Text(settings.t(type == WType.withDeduction ? "type_hold_sub" : "type_nohold_sub")).font(.system(size: 13)).foregroundColor(AppColor.muted)
            }
            Spacer()
        }
        .padding(18).background(active ? tint : AppColor.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(active ? fg : AppColor.line, lineWidth: 2))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .onTapGesture { wtype = type; if type == WType.noDeduction { employeeId = nil } }
    }

    private var checkDot: some View {
        ZStack { Circle().fill(AppColor.green).frame(width: 24, height: 24)
            Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundColor(.white) }
    }

    private func summaryRow(_ label: String, _ value: String) -> some View {
        HStack { Text(label).font(.system(size: 13)).foregroundColor(AppColor.muted); Spacer()
            Text(value).font(.system(size: 13, weight: .semibold)).foregroundColor(AppColor.text) }
    }

    // MARK: действия
    private func upload(_ data: Data) async {
        uploading = true; error = nil
        do {
            let r = try await APIClient.shared.uploadPhoto(data)
            if photos.count < maxPhotos {
                photos.append(UploadedPhoto(url: r.url, recognition: r.recognition))
                // Автозаполнение причины из подсказки ИИ, если комментарий ещё пуст
                if let reason = r.recognition?.suggestedReason,
                   comment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    comment = reason
                }
            }
        }
        catch { self.error = (error as? APIError)?.message ?? settings.t("error_generic") }
        uploading = false
    }

    private func next() {
        guard valid else { return }
        if isLast { Task { await submit() } } else { stepIndex += 1 }
    }
    private func prev() {
        if stepIndex == 0 { dismiss() } else { stepIndex -= 1 }
    }

    private func submit() async {
        error = nil
        do {
            _ = try await store.create([
                "store_id": storeId,
                "type": wtype,
                "deduction_employee_id": wtype == WType.withDeduction ? employeeId : nil,
                "comment": comment.trimmingCharacters(in: .whitespacesAndNewlines),
                "photo_urls": photos.map(\.url),
            ])
            settings.showToast(settings.t("sent_toast"))
            reset()
            await store.loadStats()
            await store.loadList()
            dismiss()
        } catch { self.error = (error as? APIError)?.message ?? settings.t("error_generic") }
    }

    private func reset() {
        stepIndex = 0; photos = []; storeId = auth.user?.storeId; wtype = ""; employeeId = nil; comment = ""; empQuery = ""
    }
}

// Карточка вердикта ИИ: что распознали модели (тип продукта + испорченность) на фото.
struct AiVerdictView: View {
    @EnvironmentObject var settings: AppSettings
    let items: [DetectedItem]
    let needsWriteoff: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ZStack { RoundedRectangle(cornerRadius: 8).fill(AppColor.greenTint).frame(width: 28, height: 28)
                    Image(systemName: "sparkles").font(.system(size: 14)).foregroundColor(AppColor.green) }
                Text(settings.t("ai_title")).font(AppFont.head(14.5)).foregroundColor(AppColor.text)
            }
            ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                HStack(spacing: 8) {
                    Text(it.product).font(.system(size: 13.5, weight: .medium)).foregroundColor(AppColor.text)
                    Spacer()
                    StateChip(state: it.state)
                    Text("\(Int((it.confidence * 100).rounded()))%")
                        .font(.system(size: 11)).foregroundColor(AppColor.faint).monospacedDigit().frame(width: 36, alignment: .trailing)
                }
            }
            Text(needsWriteoff ? settings.t("ai_writeoff") : settings.t("ai_ok"))
                .font(.system(size: 12)).foregroundColor(needsWriteoff ? AppColor.red : AppColor.muted)
        }
        .padding(16)
        .background(AppColor.surface2)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(needsWriteoff ? AppColor.red : AppColor.line, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// Чип состояния от классификатора → цвет/подпись
struct StateChip: View {
    @EnvironmentObject var settings: AppSettings
    let state: String

    private var style: (String, Color, Color) {
        switch state {
        case "spoiled": return (settings.t("ai_state_spoiled"), AppColor.red, AppColor.redTint)
        case "defect":  return (settings.t("ai_state_defect"), AppColor.orange, AppColor.orangeTint)
        case "good":    return (settings.t("ai_state_good"), AppColor.green, AppColor.greenTint)
        default:        return (state, AppColor.muted, AppColor.surface2)
        }
    }

    var body: some View {
        let s = style
        Text(s.0).font(.system(size: 11, weight: .semibold))
            .padding(.horizontal, 7).padding(.vertical, 2)
            .foregroundColor(s.1).background(s.2).clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
