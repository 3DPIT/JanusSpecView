import { Route, Routes } from "react-router-dom";
import { SwaggerView } from "./views/swaggerView/SwaggerView";
import { Home } from "./views/home/Home";
import { SwaggerViewDetail } from "./views/swaggerViewDetail/SwaggerViewDetail";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />}></Route>
      <Route path="/swagger-view" element={<SwaggerView />}></Route>
      <Route
        path="/swagger-view/:serviceName"
        element={<SwaggerViewDetail />}
      ></Route>
    </Routes>
  );
}

export default App;
