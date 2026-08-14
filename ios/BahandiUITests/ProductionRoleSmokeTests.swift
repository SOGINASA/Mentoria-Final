import XCTest

final class BackendRoleSmokeTests: XCTestCase {
    private struct RoleScenario {
        let username: String
        let role: String
        let tabs: [(label: String, screen: String)]
    }

    private let roles: [RoleScenario] = [
        .init(username: "sender1", role: "sender", tabs: [("Сегодня", "platform.today.ready"), ("Смены", "platform.screen.Мой график"), ("Задачи", "platform.screen.Мои задачи"), ("Сервисы", "platform.screen.Сервисы сотрудника"), ("Профиль", "platform.screen.Профиль")]),
        .init(username: "manager", role: "manager", tabs: [("Сегодня", "platform.today.ready"), ("Точка", "platform.screen.Управление точкой"), ("Согласования", "platform.screen.Согласования"), ("Сервисы", "platform.screen.Сервисы сотрудника"), ("Профиль", "platform.screen.Профиль")]),
        .init(username: "reviewer", role: "reviewer", tabs: [("Сегодня", "platform.today.ready"), ("Контроль", "platform.screen.Контроль точек"), ("Согласования", "platform.screen.Согласования"), ("Сервисы", "platform.screen.Сервисы сотрудника"), ("Профиль", "platform.screen.Профиль")]),
        .init(username: "hr", role: "hr", tabs: [("Сегодня", "platform.today.ready"), ("HR", "platform.screen.HR-кабинет"), ("Заявки", "platform.screen.Согласования"), ("Сервисы", "platform.screen.Сервисы сотрудника"), ("Профиль", "platform.screen.Профиль")]),
        .init(username: "finance", role: "finance", tabs: [("Сегодня", "platform.today.ready"), ("Финансы", "platform.screen.Финансы"), ("Сервисы", "platform.screen.Сервисы сотрудника"), ("Профиль", "platform.screen.Профиль")]),
        .init(username: "operations", role: "operations", tabs: [("Сегодня", "platform.today.ready"), ("Операции", "platform.screen.Операционный центр"), ("Управление", "platform.screen.Управление точками"), ("Решения", "platform.screen.Согласования"), ("Профиль", "platform.screen.Профиль")]),
        .init(username: "admin", role: "admin", tabs: [("Система", "platform.screen.Управление системой"), ("Доступы", "platform.admin.directory"), ("Списания", "platform.writeoffs.queue"), ("Профиль", "platform.screen.Профиль")]),
    ]

    func testLoginAndBootstrapForEveryRole() throws {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing-reset-session")
        app.launch()

        for role in roles {
            let demoButton = app.buttons["login.demo.\(role.username)"]
            scrollUntilVisible(demoButton, in: app)
            XCTAssertTrue(demoButton.waitForExistence(timeout: 5), "Нет кнопки входа для \(role.username)")
            demoButton.tap()

            let root = app.descendants(matching: .any)["staff-platform.\(role.role)"]
            XCTAssertTrue(root.waitForExistence(timeout: 20), "Не выполнен вход для \(role.username)")

            for target in role.tabs {
                let tab = app.tabBars.buttons[target.label]
                XCTAssertTrue(tab.waitForExistence(timeout: 8), "Нет вкладки \(target.label) для \(role.username)")
                tab.tap()
                let screen = app.descendants(matching: .any)[target.screen]
                XCTAssertTrue(screen.waitForExistence(timeout: 20), "Не открылся экран \(target.label) для \(role.username)")
                XCTAssertFalse(app.staticTexts["Не удалось загрузить"].exists, "Backend вернул ошибку на \(target.label) для \(role.username)")
            }

            verifyNestedNavigation(for: role, app: app)

            app.tabBars.buttons["Профиль"].tap()
            let logout = app.buttons["profile.logout"]
            scrollUntilVisible(logout, in: app)
            XCTAssertTrue(logout.waitForExistence(timeout: 5))
            logout.tap()
            XCTAssertTrue(app.buttons["login.submit"].waitForExistence(timeout: 8))
        }
    }

    private func verifyNestedNavigation(for role: RoleScenario, app: XCUIApplication) {
        if role.role == "sender" {
            app.tabBars.buttons["Сервисы"].tap()
            openIfAvailable("service.learning", screen: "platform.screen.Обучение и допуски", app: app)
            openIfAvailable("service.documents", screen: "platform.screen.Мои документы", app: app)
            openIfAvailable("service.leave", screen: "platform.screen.Отпуск и отсутствие", app: app)
            openIfAvailable("service.support", screen: "platform.screen.Помощь и обращения", app: app)
            openIfAvailable("service.income", screen: "platform.screen.Доход", app: app)
            openIfAvailable("service.news", screen: "platform.screen.Новости команды", app: app)
            openIfAvailable("service.tasks", screen: "platform.screen.Мои задачи", app: app)
        } else if role.role == "manager" {
            app.tabBars.buttons["Точка"].tap()
            openAndReturn("manager.shifts", screen: "platform.screen.Смены и команда", app: app)
            openAndReturn("manager.tasks", screen: "platform.screen.Задачи точки", app: app)
            openAndReturn("manager.analytics", screen: "platform.screen.Аналитика точки", app: app)
            openIfAvailable("manager.news", screen: "platform.screen.Новости команды", app: app)
            openIfAvailable("manager.cases", screen: "platform.screen.Помощь и обращения", app: app)
        } else if role.role == "operations" {
            app.tabBars.buttons["Управление"].tap()
            openAndReturn("manager.shifts", screen: "platform.screen.Смены и команда", app: app)
            openAndReturn("manager.tasks", screen: "platform.screen.Задачи точки", app: app)
        } else if role.role == "admin" {
            app.tabBars.buttons["Система"].tap()
            openAndReturn("admin.flags", screen: "platform.screen.Доступность функций", app: app)
            openAndReturn("admin.audit", screen: "platform.screen.Журнал действий", app: app)
            openAndReturn("admin.analytics", screen: "platform.admin.analytics", app: app)
        }
    }

    private func openAndReturn(_ identifier: String, screen: String, app: XCUIApplication) {
        let link = app.descendants(matching: .any)[identifier]
        scrollUntilVisible(link, in: app)
        XCTAssertTrue(link.waitForExistence(timeout: 8), "Не найдена ссылка \(identifier)")
        link.tap()
        XCTAssertTrue(app.descendants(matching: .any)[screen].waitForExistence(timeout: 15), "Не открылся \(screen)")
        let back = app.navigationBars.buttons.element(boundBy: 0)
        XCTAssertTrue(back.waitForExistence(timeout: 5), "Нет кнопки возврата из \(screen)")
        back.tap()
    }

    private func openIfAvailable(_ identifier: String, screen: String, app: XCUIApplication) {
        let link = app.descendants(matching: .any)[identifier]
        guard link.exists else { return }
        openAndReturn(identifier, screen: screen, app: app)
    }

    private func scrollUntilVisible(_ element: XCUIElement, in app: XCUIApplication) {
        var attempts = 0
        while (!element.exists || !element.isHittable) && attempts < 8 {
            app.swipeUp()
            attempts += 1
        }
    }
}
