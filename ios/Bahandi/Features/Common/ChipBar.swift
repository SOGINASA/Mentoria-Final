import SwiftUI

struct ChipBar: View {
    let items: [(key: String, label: String)]
    @Binding var selection: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items, id: \.key) { item in
                    let active = item.key == selection
                    Button { selection = item.key } label: {
                        Text(item.label).font(.system(size: 13, weight: .semibold))
                            .padding(.horizontal, 15).padding(.vertical, 8)
                            .foregroundColor(active ? .white : AppColor.muted)
                            .background(active ? AppColor.green : AppColor.surface)
                            .overlay(Capsule().stroke(active ? AppColor.green : AppColor.line, lineWidth: 1.5))
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal, 1)
        }
    }
}
