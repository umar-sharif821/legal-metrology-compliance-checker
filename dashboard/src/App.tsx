import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastHost } from './components/ui';
import { ScansProvider } from './lib/store';
import { Overview } from './pages/Overview';
import { ScanPage } from './pages/ScanPage';
import { ScansPage } from './pages/ScansPage';
import { ReportPage } from './pages/ReportPage';
import { RulePackPage } from './pages/RulePackPage';
import { NotFound } from './pages/NotFound';
import { HowItWorks } from './pages/HowItWorks';

export default function App() {
  return (
    <BrowserRouter>
      <ScansProvider>
        <ToastHost>
          <Layout>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/scans" element={<ScansPage />} />
              <Route path="/scans/:id" element={<ReportPage />} />
              <Route path="/rulepack" element={<RulePackPage />} />
              <Route path="/how" element={<HowItWorks />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </ToastHost>
      </ScansProvider>
    </BrowserRouter>
  );
}
