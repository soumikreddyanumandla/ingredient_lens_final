import { Routes, Route } from "react-router-dom";
import { ComparePage, CompatibilityPage, HomePage, SearchPage, GlobalSearchPage, AnalysisPage, HistoryPage, NotFound } from "./pages";

export default function App(){
  return <Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/search" element={<GlobalSearchPage/>}/>
    <Route path="/search/:category" element={<SearchPage/>}/>
    <Route path="/analysis" element={<AnalysisPage/>}/>
    <Route path="/compare" element={<ComparePage/>}/>
    <Route path="/compatibility" element={<CompatibilityPage/>}/>
    <Route path="/history" element={<HistoryPage/>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes>;
}
