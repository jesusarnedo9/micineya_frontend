// Prueba de la configuración real de Tabs, sin arrancar un dispositivo ni cargar APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/app/(app)/_layout.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

for (const bottom of [0, 16, 24, 48]) {
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const Tabs = { Screen: 'Screen' };
  vm.runInNewContext(compiled, {
    exports,
    require(id) {
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (id === '@expo/vector-icons') return { Ionicons: 'Icon' };
      if (id === 'expo-router') return { Tabs };
      if (id === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom, left: 0, right: 0 }) };
      if (id === '../../context/app-experience') return { AppExperienceProvider: 'Provider' };
      throw new Error(`Import no contemplado: ${id}`);
    },
  });
  const tabs = exports.default().props.children;
  const { tabBarStyle, tabBarLabelPosition } = tabs.props.screenOptions;
  assert.ok(tabBarStyle.paddingBottom >= bottom, `Reservar el borde inferior de ${bottom}`);
  assert.equal(tabBarStyle.height - tabBarStyle.paddingBottom, 58, 'Conservar el área útil de los botones');
  assert.equal(tabBarLabelPosition, 'below-icon');
}
console.log('OK: barra inferior con espacios de sistema de 0, 16, 24 y 48 puntos.');
