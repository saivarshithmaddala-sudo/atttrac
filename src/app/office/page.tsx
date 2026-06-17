import Dashboard from '@/components/Dashboard'
import { getMonthlyData } from '@/lib/dashboard'

export default async function Home({ searchParams }: { searchParams: Promise<{ month?: string, year?: string }> | { month?: string, year?: string } }) {
  const resolvedParams = await searchParams;
  const month = resolvedParams.month ? parseInt(resolvedParams.month) : new Date().getMonth() + 1
  const year = resolvedParams.year ? parseInt(resolvedParams.year) : new Date().getFullYear()

  const data = await getMonthlyData(month, year, 'OFFICE')

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-2 sm:p-4 bg-slate-50 ">
      <Dashboard initialData={data} initialMonth={month} initialYear={year} basePath="/office" title="Office Attendance Dashboard" />
    </main>
  )
}
