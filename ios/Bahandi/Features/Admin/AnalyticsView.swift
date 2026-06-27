import SwiftUI

// Средняя оценочная стоимость одного списания (реальной цены в данных нет).
private let avgLoss = 1500

private func money(_ n: Int) -> String {
    let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "
    return "≈ \(f.string(from: NSNumber(value: n)) ?? "\(n)") ₸"
}

struct AnalyticsView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var list: [WriteOff] = []
    @State private var loading = true

    var body: some View {
        Group {
            if loading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if list.isEmpty {
                EmptyStateView(icon: "chart.bar", title: settings.t("an_empty"))
            } else {
                ScrollView { content.padding(20) }
            }
        }
        .background(AppColor.bg)
        .navigationTitle(settings.t("nav_analytics"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        loading = true
        list = (try? await APIClient.shared.writeOffs(perPage: 200).writeOffs) ?? []
        loading = false
    }

    // MARK: агрегаты
    private var total: Int { list.count }
    private var approved: Int { list.filter { $0.status == WStatus.approved }.count }
    private var pending: Int { list.filter { $0.status == WStatus.pending }.count }
    private var withHold: [WriteOff] { list.filter { $0.type == WType.withDeduction } }
    private var noHold: Int { total - withHold.count }

    private func group(_ src: [WriteOff], _ key: (WriteOff) -> String?) -> [(name: String, count: Int)] {
        var map: [String: Int] = [:]
        for w in src { if let k = key(w) { map[k, default: 0] += 1 } }
        return map.map { ($0.key, $0.value) }.sorted { $0.1 > $1.1 }.prefix(6).map { (name: $0.0, count: $0.1) }
    }

    private var byStore: [(name: String, count: Int)] { group(list) { $0.store?.name } }
    private var byEmployee: [(name: String, count: Int)] { group(withHold) { $0.deductionEmployee?.fullName } }

    private var days: [(label: String, count: Int)] {
        let cal = Calendar.current
        return (0..<7).reversed().map { offset in
            let day = cal.date(byAdding: .day, value: -offset, to: Date())!
            let c = list.filter { parseDate($0.createdAt).map { cal.isDate($0, inSameDayAs: day) } ?? false }.count
            return (day.formatted(.dateTime.day(.twoDigits).month(.twoDigits)), c)
        }
    }

    @ViewBuilder private var content: some View {
        VStack(spacing: 18) {
            // карточка потерь
            VStack(alignment: .leading, spacing: 4) {
                Text(settings.t("an_loss_est")).font(.system(size: 13)).foregroundColor(.white.opacity(0.85))
                Text(money(total * avgLoss)).font(AppFont.head(32)).foregroundColor(.white)
                Text(settings.t("an_loss_note")).font(.system(size: 12)).foregroundColor(.white.opacity(0.75))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(LinearGradient(colors: [AppColor.green, AppColor.greenD], startPoint: .topLeading, endPoint: .bottomTrailing))
            .clipShape(RoundedRectangle(cornerRadius: 18))

            // KPI
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                kpi(total, "an_total", AppColor.text)
                kpi(approved, "an_approved", AppColor.green)
                kpi(pending, "an_pending", AppColor.amber)
                kpi(withHold.count, "an_with_hold", AppColor.orange)
            }

            // по точкам
            section("an_by_store") {
                let maxC = max(byStore.map(\.count).max() ?? 1, 1)
                ForEach(byStore, id: \.name) { g in
                    BarRow(label: g.name, trailing: "\(g.count) \(settings.t("an_writeoffs_n")) · \(money(g.count * avgLoss))", pct: Double(g.count) / Double(maxC), color: AppColor.green)
                }
            }

            // по сотрудникам
            if !byEmployee.isEmpty {
                section("an_by_employee") {
                    let maxC = max(byEmployee.map(\.count).max() ?? 1, 1)
                    ForEach(byEmployee, id: \.name) { g in
                        BarRow(label: g.name, trailing: "\(g.count) · \(money(g.count * avgLoss))", pct: Double(g.count) / Double(maxC), color: AppColor.orange)
                    }
                }
            }

            // по типу
            section("an_by_type") {
                BarRow(label: settings.t("type_hold"), trailing: "\(withHold.count)", pct: total > 0 ? Double(withHold.count) / Double(total) : 0, color: AppColor.orange)
                BarRow(label: settings.t("type_nohold"), trailing: "\(noHold)", pct: total > 0 ? Double(noHold) / Double(total) : 0, color: AppColor.green)
            }

            // динамика
            section("an_trend") {
                let maxD = max(days.map(\.count).max() ?? 1, 1)
                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(Array(days.enumerated()), id: \.offset) { _, d in
                        VStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(d.count > 0 ? AppColor.green : AppColor.line)
                                .frame(height: max(CGFloat(Double(d.count) / Double(maxD)) * 90, d.count > 0 ? 6 : 2))
                                .frame(maxWidth: .infinity)
                            Text("\(d.count)").font(.system(size: 10)).foregroundColor(AppColor.faint).monospacedDigit()
                            Text(d.label).font(.system(size: 10)).foregroundColor(AppColor.muted)
                        }
                    }
                }
                .frame(height: 130, alignment: .bottom)
            }
        }
    }

    private func kpi(_ value: Int, _ key: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(value)").font(AppFont.head(28)).foregroundColor(color)
            Text(settings.t(key)).font(.system(size: 11.5, weight: .medium)).foregroundColor(AppColor.muted).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .bahandiCard()
    }

    private func section<C: View>(_ titleKey: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(settings.t(titleKey)).font(.system(size: 12, weight: .semibold)).foregroundColor(AppColor.faint).textCase(.uppercase)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(AppColor.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(AppColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

private struct BarRow: View {
    let label: String
    let trailing: String
    let pct: Double
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(label).font(.system(size: 13, weight: .medium)).foregroundColor(AppColor.text).lineLimit(1)
                Spacer()
                Text(trailing).font(.system(size: 12)).foregroundColor(AppColor.muted).lineLimit(1)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(AppColor.surface2)
                    Capsule().fill(color).frame(width: max(geo.size.width * CGFloat(pct), 6))
                }
            }
            .frame(height: 8)
        }
    }
}
