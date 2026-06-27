import SwiftUI

func initials(_ name: String?) -> String {
    guard let name, !name.isEmpty else { return "?" }
    let parts = name.split(separator: " ")
    let first = parts.first.map { String($0.prefix(1)) } ?? ""
    let second = parts.count > 1 ? String(parts[1].prefix(1)) : ""
    return (first + second).uppercased()
}

private let isoFull: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
}()
private let isoPlain = ISO8601DateFormatter()

func parseDate(_ iso: String?) -> Date? {
    guard let iso else { return nil }
    return isoFull.date(from: iso) ?? isoPlain.date(from: iso)
}

/// «Сегодня, 14:20» / «Вчера, 12:05» / «13.06, 09:15»
func dateLabel(_ iso: String?, lang: String) -> String {
    guard let date = parseDate(iso) else { return "" }
    let cal = Calendar.current
    let time = date.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits))
    if cal.isDateInToday(date) { return (lang == "kz" ? "Бүгін" : "Сегодня") + ", \(time)" }
    if cal.isDateInYesterday(date) { return (lang == "kz" ? "Кеше" : "Вчера") + ", \(time)" }
    let dm = date.formatted(.dateTime.day(.twoDigits).month(.twoDigits))
    return "\(dm), \(time)"
}

struct StatusStyle { let fg: Color; let bg: Color; let labelKey: String }

func statusStyle(_ status: String) -> StatusStyle {
    switch status {
    case WStatus.approved: return StatusStyle(fg: AppColor.green, bg: AppColor.greenTint, labelKey: "st_approved")
    case WStatus.rejected: return StatusStyle(fg: AppColor.red, bg: AppColor.redTint, labelKey: "st_rejected")
    default: return StatusStyle(fg: AppColor.amber, bg: AppColor.amberTint, labelKey: "st_pending")
    }
}

func typeLabelKey(_ type: String) -> String {
    type == WType.withDeduction ? "type_hold" : "type_nohold"
}
