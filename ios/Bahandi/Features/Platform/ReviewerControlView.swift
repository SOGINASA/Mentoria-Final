import SwiftUI

struct ReviewerControlView: View {
    private enum Section: String, CaseIterable, Identifiable {
        case queue = "Очередь"
        case analytics = "Аналитика"
        var id: String { rawValue }
    }

    @State private var section = Section.queue
    @State private var stores: [Store] = []
    @State private var selectedStoreID: Int?
    @State private var writeOffs: [WriteOff] = []
    @State private var pagination: Pagination?
    @State private var analytics: WriteOffAnalytics?
    @State private var days = 30
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        Group {
            if loading && writeOffs.isEmpty && analytics == nil {
                PlatformLoadingView()
            } else if let error, writeOffs.isEmpty && analytics == nil {
                PlatformErrorView(message: error) { Task { await load() } }
            } else {
                PlatformScreen("Контроль точек", subtitle: "Списания и показатели закреплённых точек") {
                    summary
                    filters
                    if section == .queue { queue }
                    else { analyticsContent }
                }
                .refreshable { await load() }
            }
        }
        .navigationTitle("Контроль")
        .platformNavigationStyle()
        .task { await load() }
        .onChange(of: selectedStoreID) { _, _ in Task { await loadContent() } }
        .onChange(of: days) { _, _ in Task { await loadAnalytics() } }
    }

    private var summary: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            MetricTile(icon: "tray.full", value: "\(pagination?.total ?? writeOffs.count)", label: "ждут решения", tone: AppColor.orange)
            MetricTile(icon: "building.2", value: "\(stores.count)", label: "точек в контроле")
            MetricTile(icon: "checkmark.circle", value: "\(analytics?.totals.approved ?? 0)", label: "подтверждено")
            MetricTile(icon: "xmark.circle", value: "\(analytics?.totals.rejected ?? 0)", label: "отклонено", tone: AppColor.orange)
        }
    }

    private var filters: some View {
        PlatformCard {
            VStack(spacing: 12) {
                Picker("Раздел", selection: $section) {
                    ForEach(Section.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                Menu {
                    Button("Все закреплённые точки") { selectedStoreID = nil }
                    ForEach(stores) { store in Button(store.name) { selectedStoreID = store.id } }
                } label: {
                    HStack {
                        Image(systemName: "building.2")
                        Text(selectedStoreName).lineLimit(1)
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down").font(.caption)
                    }
                    .foregroundStyle(AppColor.text)
                    .frame(minHeight: 44)
                }
            }
        }
    }

    @ViewBuilder private var queue: some View {
        HStack {
            PlatformSectionTitle(title: "Списания на проверку")
            Spacer()
            NavigationLink("История") { HistoryView() }.font(.subheadline.weight(.semibold)).foregroundStyle(AppColor.green)
        }
        if writeOffs.isEmpty {
            ContentUnavailableView("Очередь пуста", systemImage: "checkmark.circle", description: Text("Все заявки уже обработаны."))
                .frame(maxWidth: .infinity, minHeight: 230)
        } else {
            ForEach(writeOffs) { item in
                NavigationLink { ReviewDetailView(id: item.id) } label: {
                    PlatformCard {
                        HStack(spacing: 12) {
                            PhotoThumb(url: item.photos?.first?.url, size: 62, radius: 15)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(item.comment.isEmpty ? "Списание #\(item.id)" : item.comment)
                                    .font(.headline).foregroundStyle(AppColor.text).lineLimit(2)
                                Text(item.store?.name ?? storeName(item.storeId)).font(.subheadline).foregroundStyle(AppColor.muted).lineLimit(1)
                                Text(item.author?.fullName ?? "Сотрудник").font(.caption).foregroundStyle(AppColor.faint).lineLimit(1)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right").foregroundStyle(AppColor.faint)
                        }
                    }
                }.buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder private var analyticsContent: some View {
        Picker("Период", selection: $days) {
            Text("7 дней").tag(7)
            Text("30 дней").tag(30)
            Text("90 дней").tag(90)
        }
        .pickerStyle(.segmented)

        if let analytics {
            PlatformSectionTitle(title: "Качество списаний")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                MetricTile(icon: "list.bullet", value: "\(analytics.totals.total)", label: "всего")
                MetricTile(icon: "person.2", value: "\(analytics.withHold)", label: "с удержанием", tone: AppColor.orange)
            }
            trendCard(analytics.trend)
            groupsCard("Точки по объёму", groups: analytics.byStore, color: AppColor.orange)
            if !analytics.byEmployee.isEmpty { groupsCard("Удержания по сотрудникам", groups: analytics.byEmployee, color: AppColor.green) }
        } else if !loading {
            ContentUnavailableView("Нет аналитики", systemImage: "chart.bar", description: Text("Для выбранного периода данных пока нет."))
                .frame(maxWidth: .infinity, minHeight: 230)
        }
    }

    private func trendCard(_ points: [WriteOffAnalyticsPoint]) -> some View {
        PlatformCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("Динамика списаний").font(.headline)
                let maximum = max(points.map(\.count).max() ?? 1, 1)
                HStack(alignment: .bottom, spacing: 3) {
                    ForEach(points) { point in
                        RoundedRectangle(cornerRadius: 3)
                            .fill(point.count > 0 ? AppColor.green : AppColor.line)
                            .frame(maxWidth: .infinity)
                            .frame(height: max(3, CGFloat(point.count) / CGFloat(maximum) * 120))
                            .accessibilityLabel("\(point.date): \(point.count)")
                    }
                }.frame(height: 125, alignment: .bottom)
            }
        }
    }

    private func groupsCard(_ title: String, groups: [WriteOffAnalyticsGroup], color: Color) -> some View {
        PlatformCard {
            VStack(alignment: .leading, spacing: 14) {
                Text(title).font(.headline)
                if groups.isEmpty { Text("За период данных нет").font(.subheadline).foregroundStyle(AppColor.muted) }
                let maximum = max(groups.map(\.count).max() ?? 1, 1)
                ForEach(groups) { group in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack { Text(group.name).lineLimit(1); Spacer(); Text("\(group.count)").fontWeight(.semibold).monospacedDigit() }
                            .font(.subheadline)
                        GeometryReader { geometry in
                            Capsule().fill(AppColor.surface2)
                                .overlay(alignment: .leading) { Capsule().fill(color).frame(width: geometry.size.width * CGFloat(group.count) / CGFloat(maximum)) }
                        }.frame(height: 8)
                    }
                }
            }
        }
    }

    private var selectedStoreName: String {
        guard let selectedStoreID else { return "Все закреплённые точки" }
        return stores.first(where: { $0.id == selectedStoreID })?.name ?? "Точка #\(selectedStoreID)"
    }

    private func storeName(_ id: Int?) -> String {
        guard let id else { return "Точка не указана" }
        return stores.first(where: { $0.id == id })?.name ?? "Точка #\(id)"
    }

    private func load() async {
        loading = true; error = nil
        do {
            let workspace = try await APIClient.shared.json("manager/workspace")
            stores = decodeStores(workspace["stores"])
            try await loadContentThrowing()
        } catch { self.error = error.localizedDescription }
        loading = false
    }

    private func loadContent() async {
        loading = true; error = nil
        do { try await loadContentThrowing() }
        catch { self.error = error.localizedDescription }
        loading = false
    }

    private func loadContentThrowing() async throws {
        async let queue = APIClient.shared.writeOffs(status: WStatus.pending, storeId: selectedStoreID, perPage: 50)
        async let report = APIClient.shared.writeOffAnalytics(days: days, storeId: selectedStoreID)
        let (queueResult, reportResult) = try await (queue, report)
        writeOffs = queueResult.writeOffs
        pagination = queueResult.pagination
        analytics = reportResult
    }

    private func loadAnalytics() async {
        do { analytics = try await APIClient.shared.writeOffAnalytics(days: days, storeId: selectedStoreID) }
        catch { self.error = error.localizedDescription }
    }

    private func decodeStores(_ value: Any?) -> [Store] {
        guard let value, JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value) else { return [] }
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        return (try? decoder.decode([Store].self, from: data)) ?? []
    }
}
