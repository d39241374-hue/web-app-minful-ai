import { getTodayDateStr } from '../constants';
import type { PublicGarden, UserProfile } from '../types';

export function exportResearchDataCSV(
  currentUser: UserProfile,
  publicGardens: PublicGarden[],
  journalCount: number,
) {
  const rows: string[] = [];
  rows.push(
    'Ho Ten,Ten Cay 3D,Lop,Truong,Cap Do Cay 3D,Chuoi Ngay,Kinh Nghiem XP,Phut Deep Work,Diem Mam,Chi So CDS-HS Gan Nhat,So Bai Nhat Ky 7 Muc,So Lan Mang Loc Thuc Tinh,Khao Sat KHKT (Q1-Q2-Q3)',
  );

  const seen = new Set<string>();
  const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

  if (currentUser.role !== 'judge') {
    seen.add(currentUser.uid);
    const s = currentUser.khktSurvey
      ? `${currentUser.khktSurvey.s1}-${currentUser.khktSurvey.s2}-${currentUser.khktSurvey.s3}`
      : 'Chua khao sat';
    rows.push(
      [
        escapeCsv(currentUser.fullname),
        escapeCsv(currentUser.treeName || 'Cây Tri Thức'),
        escapeCsv(currentUser.className),
        escapeCsv(currentUser.schoolName),
        currentUser.level || 1,
        currentUser.streakDays || 1,
        currentUser.xp || 0,
        currentUser.todayFocusMins || 0,
        currentUser.seedPoints || 0,
        currentUser.lastCdsScore ? currentUser.lastCdsScore.toFixed(2) : 'N/A',
        journalCount,
        currentUser.socialInterruptionCount || 0,
        escapeCsv(s),
      ].join(','),
    );
  }

  publicGardens.forEach((g) => {
    if (seen.has(g.uid)) return;
    seen.add(g.uid);
    rows.push(
      [
        escapeCsv(g.fullname),
        escapeCsv(g.treeName || 'Cây Tri Thức'),
        escapeCsv(g.className),
        escapeCsv(g.schoolName),
        g.level || 1,
        g.streakDays || 1,
        g.xp || 0,
        g.todayFocusMins || 0,
        0,
        'N/A',
        0,
        0,
        '"Cong khai"',
      ].join(','),
    );
  });

  const bom = '\uFEFF';
  const blob = new Blob([bom + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Du_Lieu_Thuc_Nghiem_Mindful_AI_HaTinh_${getTodayDateStr()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
