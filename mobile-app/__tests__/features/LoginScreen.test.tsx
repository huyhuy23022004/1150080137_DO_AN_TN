import { fireEvent, render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from '../../src/features/auth/LoginScreen';
import { store } from '../../src/store';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
  }),
}));

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderLogin() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <Provider store={store}>
        <LoginScreen />
      </Provider>
    </SafeAreaProvider>,
  );
}

describe('LoginScreen', () => {
  it('renders the login form', async () => {
    const view = await renderLogin();

    expect(view.getByText('Chào mừng trở lại')).toBeOnTheScreen();
    expect(view.getByTestId('login-phone')).toBeOnTheScreen();
    expect(view.getByTestId('login-password')).toBeOnTheScreen();
    expect(view.getByTestId('login-submit')).toBeOnTheScreen();
  });

  it('shows validation errors without calling the API', async () => {
    const view = await renderLogin();

    await fireEvent.changeText(view.getByTestId('login-phone'), '123');
    await fireEvent.press(view.getByTestId('login-submit'));

    expect(await view.findByText('Số điện thoại không hợp lệ')).toBeOnTheScreen();
    expect(view.getByText('Vui lòng nhập mật khẩu')).toBeOnTheScreen();
  });
});
