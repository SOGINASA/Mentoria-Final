// Роли пользователей. Совпадают с back/constants.py
export const ROLE_SENDER = 'sender'; // Отправитель (сотрудник торговой точки)
export const ROLE_REVIEWER = 'reviewer'; // Проверяющий
export const ROLE_ADMIN = 'admin'; // Администратор

// Стартовый маршрут после входа в зависимости от роли
export const HOME_ROUTE_BY_ROLE = {
  [ROLE_SENDER]: '/',
  [ROLE_REVIEWER]: '/review',
  [ROLE_ADMIN]: '/review',
};
