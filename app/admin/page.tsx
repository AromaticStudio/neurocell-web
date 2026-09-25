'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_PASSWORD = 'coach1234';

// 한국 시간(KST) 기준 YYYY-MM-DD 문자열 추출 함수
const toKSTDateString = (dateInput: Date | string = new Date()) => {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

// 한국 날짜 기준 Day 계산
const calculateAdminUserDay = (approvedAt: string | null) => {
  if (!approvedAt) return 1;

  const todayYMD = toKSTDateString(new Date());
  const approvedYMD = toKSTDateString(approvedAt);

  const [tY, tM, tD] = todayYMD.split('-').map(Number);
  const [aY, aM, aD] = approvedYMD.split('-').map(Number);

  const utcToday = Date.UTC(tY, tM - 1, tD);
  const utcApproved = Date.UTC(aY, aM - 1, aD);

  const diffDays = Math.floor((utcToday - utcApproved) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPw, setInputPw] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'content' | 'participants'>('dashboard');
  const [participants, setParticipants] = useState<any[]>([]);
  const [rawMissionLogs, setRawMissionLogs] = useState<any[]>([]);
  const [dayList, setDayList] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 코치 노트 상태
  const [coachNote, setCoachNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // 강의 등록/수정 모달 상태
  const [editingLecture, setEditingLecture] = useState<any>(null);
  const [isNewLecture, setIsNewLecture] = useState(false);
  const [isSavingLecture, setIsSavingLecture] = useState(false);

  // 코치 노트 불러오기
  const fetchCoachNote = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'coach_note')
      .maybeSingle();

    if (data?.value) {
      setCoachNote(data.value);
    }
  };

  // 코치 노트 저장하기
  const handleSaveCoachNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachNote.trim()) {
      alert('코치 노트 내용을 입력해 주세요.');
      return;
    }

    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'coach_note',
          value: coachNote.trim(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
      alert('코치 노트가 성공적으로 업데이트되었습니다!\n(모든 회원의 투데이 화면에 즉시 반영됩니다)');
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  // 강의 목록 불러오기
  const fetchLectures = async () => {
    const { data } = await supabase.from('lectures').select('*').order('day', { ascending: true });
    if (data) setDayList(data);
  };

  // 회원 목록 및 로그 불러오기
  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const [{ data: profilesData, error: pError }, { data: missionLogsData }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('mission_logs').select('user_id, log_date, completed').eq('completed', true),
      ]);

      if (!pError && profilesData) {
        if (missionLogsData) {
          setRawMissionLogs(missionLogsData);
        }

        const userCompleteDaysMap: { [userId: string]: number } = {};
        if (missionLogsData) {
          const userDateCounts: { [userId: string]: { [date: string]: number } } = {};
          missionLogsData.forEach(log => {
            if (!userDateCounts[log.user_id]) userDateCounts[log.user_id] = {};
            userDateCounts[log.user_id][log.log_date] = (userDateCounts[log.user_id][log.log_date] || 0) + 1;
          });

          Object.keys(userDateCounts).forEach(uid => {
            const count = Object.values(userDateCounts[uid]).filter(cnt => cnt >= 10).length;
            userCompleteDaysMap[uid] = count;
          });
        }

        const mapped = profilesData.map((p, idx) => {
          const currentDay = calculateAdminUserDay(p.approved_at);
          const realCompletedDays = userCompleteDaysMap[p.id] || 0;
          const duration = p.challenge_duration || 30;

          return {
            id: p.id,
            name: p.nickname || `참여자 ${idx + 1}`,
            startDate: p.approved_at ? toKSTDateString(p.approved_at) : (p.created_at ? toKSTDateString(p.created_at) : '-'),
            currentDay,
            streak: realCompletedDays,
            status: p.status || 'pending',
            duration,
            rawApprovedAt: p.approved_at,
            height: p.height,
            target_weight: p.target_weight,
          };
        });
        setParticipants(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchParticipants();
      fetchLectures();
      fetchCoachNote();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPw === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('비밀번호가 일치하지 않습니다.');
    }
  };

  // 회원별 코스 기간 변경
  const handleUpdateDuration = async (userId: string, newDuration: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ challenge_duration: newDuration })
        .eq('id', userId);

      if (error) throw error;

      setParticipants(prev =>
        prev.map(p => (p.id === userId ? { ...p, duration: newDuration } : p))
      );
      if (selectedUser?.id === userId) {
        setSelectedUser((prev: any) => ({ ...prev, duration: newDuration }));
      }
    } catch (err: any) {
      alert(`기간 변경 실패: ${err.message}`);
    }
  };

  // 승인 / 승인 취소 토글
  const toggleApproval = async (user: any) => {
    const isCancelling = user.status === 'approved';

    if (isCancelling) {
      const ok = confirm(
        `[승인 취소 / 기수 종료]\n\n` +
        `'${user.name}' 회원의 승인을 취소하시겠습니까?\n` +
        `• 루틴 체크(미션 로그)는 다음 기수를 위해 초기화됩니다.\n` +
        `• 키, 목표체중, 체중 변화 기록은 안전하게 유지됩니다.`
      );
      if (!ok) return;
    }

    const nextStatus = isCancelling ? 'pending' : 'approved';
    const updateData: any = {
      status: nextStatus,
      approved_at: nextStatus === 'approved' ? new Date().toISOString() : null,
    };

    try {
      const { error: pError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (pError) throw pError;

      if (isCancelling) {
        await supabase
          .from('mission_logs')
          .delete()
          .eq('user_id', user.id);
      }

      await fetchParticipants();
      alert(
        nextStatus === 'approved'
          ? `${user.name}님이 승인되었습니다. (Day 1 시작)`
          : `${user.name}님의 승인이 취소되고 이전 미션 로그가 깔끔하게 초기화되었습니다.`
      );

      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
      }
    } catch (err: any) {
      alert(`처리 실패: ${err.message}`);
    }
  };

  // 회원 완전 탈퇴
  const handleDeleteUserCompletely = async (user: any) => {
    const check1 = confirm(
      `⚠️ [회원 영구 탈퇴 및 데이터 완전 파기]\n\n` +
      `'${user.name}' 회원의 모든 데이터를 DB에서 영구 삭제하시겠습니까?\n` +
      `• 프로필, 미션 로그, 체중 변화 기록 일체가 영구 파기됩니다.\n` +
      `• 삭제 후에는 복구할 수 없습니다.`
    );
    if (!check1) return;

    const check2 = prompt(`확인을 위해 회원의 이름('${user.name}')을 정확히 입력해 주세요.`);
    if (check2 !== user.name) {
      alert('회원 이름이 일치하지 않아 취소되었습니다.');
      return;
    }

    try {
      await supabase.from('mission_logs').delete().eq('user_id', user.id);
      await supabase.from('weight_records').delete().eq('user_id', user.id);
      const { error: profError } = await supabase.from('profiles').delete().eq('id', user.id);

      if (profError) throw profError;

      alert(`${user.name} 회원의 모든 데이터가 영구 파기(탈퇴 처리)되었습니다.`);
      setSelectedUser(null);
      await fetchParticipants();
    } catch (err: any) {
      alert(`탈퇴 처리 실패: ${err.message}`);
    }
  };

  // 대기자 일괄 승인
  const handleApproveAll = async () => {
    const pendingUsers = participants.filter(p => p.status !== 'approved');
    if (pendingUsers.length === 0) {
      alert('승인할 대기자가 없습니다.');
      return;
    }

    if (!confirm(`현재 입금 대기 중인 ${pendingUsers.length}명을 모두 승인하시겠습니까?`)) {
      return;
    }

    try {
      const pendingIds = pendingUsers.map(p => p.id);
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .in('id', pendingIds);

      if (error) {
        alert(`일괄 승인 실패: ${error.message}`);
      } else {
        await fetchParticipants();
        alert(`${pendingUsers.length}명이 모두 승인되었습니다.`);
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    }
  };

  // 전체 기수 일괄 종료
  const handleResetAll = async () => {
    const approvedUsers = participants.filter(p => p.status === 'approved');
    if (approvedUsers.length === 0) {
      alert('승인 취소할 회원이 없습니다.');
      return;
    }

    if (!confirm(
      `[기수 일괄 종료]\n\n승인된 회원 ${approvedUsers.length}명을 모두 대기 상태로 되돌리고, 각 회원의 미션 로그를 초기화하시겠습니까?\n(키, 체중 기록은 안전하게 보존됩니다.)`
    )) {
      return;
    }

    try {
      const approvedIds = approvedUsers.map(p => p.id);

      const { error } = await supabase
        .from('profiles')
        .update({ status: 'pending', approved_at: null })
        .in('id', approvedIds);

      if (error) throw error;

      await supabase
        .from('mission_logs')
        .delete()
        .in('user_id', approvedIds);

      await fetchParticipants();
      alert('모든 회원의 기수가 종료되고 미션 기록이 초기화되었습니다.');
    } catch (err: any) {
      alert(`일괄 취소 실패: ${err.message}`);
    }
  };

  // 신규 영상 등록 모달 열기
  const handleOpenNewLectureModal = () => {
    const nextDay = dayList.length > 0 ? Math.max(...dayList.map(d => d.day)) + 1 : 1;
    setEditingLecture({
      day: nextDay,
      week: `Week ${Math.ceil(nextDay / 7)}`,
      title: '',
      video_url: '',
      description: '',
      category: 'health',
    });
    setIsNewLecture(true);
  };

  // 강의 내용 저장
  const handleSaveLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLecture) return;
    if (!editingLecture.day || editingLecture.day <= 0) {
      alert('올바른 Day 숫자를 입력해 주세요.');
      return;
    }

    setIsSavingLecture(true);

    try {
      const { error } = await supabase
        .from('lectures')
        .upsert({
          day: Number(editingLecture.day),
          week: editingLecture.week || `Week ${Math.ceil(Number(editingLecture.day) / 7)}`,
          title: editingLecture.title || `Day ${editingLecture.day} 영상`,
          video_url: editingLecture.video_url || '',
          description: editingLecture.description || '',
          category: editingLecture.category || 'health',
        }, { onConflict: 'day' });

      if (error) {
        alert(`저장 실패: ${error.message}`);
      } else {
        alert(`Day ${editingLecture.day} 영상이 저장되었습니다.`);
        setEditingLecture(null);
        fetchLectures();
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingLecture(false);
    }
  };

  // 강의 삭제
  const handleDeleteLecture = async (lecture: any) => {
    if (!confirm(`[Day ${lecture.day}] '${lecture.title}' 영상을 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('lectures')
        .delete()
        .eq('day', lecture.day);

      if (error) throw error;

      alert(`Day ${lecture.day} 영상이 삭제되었습니다.`);
      fetchLectures();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 🔔 3일 이상 미인증 회원만 탐지하는 로직
  const inactiveAlerts = useMemo(() => {
    const todayStr = toKSTDateString(new Date());
    const [tY, tM, tD] = todayStr.split('-').map(Number);
    const todayUtc = Date.UTC(tY, tM - 1, tD);

    const inactiveList: any[] = [];
    const approvedMembers = participants.filter(p => p.status === 'approved' && p.currentDay <= p.duration);

    approvedMembers.forEach(member => {
      const userLogs = rawMissionLogs.filter(l => l.user_id === member.id && l.completed);

      let lastActiveDateStr = member.startDate !== '-' ? member.startDate : null;
      if (userLogs.length > 0) {
        const sortedDates = userLogs.map(l => l.log_date).sort();
        lastActiveDateStr = sortedDates[sortedDates.length - 1];
      }

      if (lastActiveDateStr) {
        const [lY, lM, lD] = lastActiveDateStr.split('-').map(Number);
        const lastUtc = Date.UTC(lY, lM - 1, lD);
        const diffDays = Math.floor((todayUtc - lastUtc) / (1000 * 60 * 60 * 24));

        if (diffDays >= 3) {
          inactiveList.push({
            ...member,
            inactiveDays: diffDays,
            lastDate: lastActiveDateStr,
          });
        }
      }
    });

    inactiveList.sort((a, b) => b.inactiveDays - a.inactiveDays);
    return inactiveList;
  }, [participants, rawMissionLogs]);

  if (!isAuthenticated) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '340px', backgroundColor: '#161616', padding: '36px 24px', borderRadius: '16px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Neuro Cell_Fit 관리자</h1>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '24px' }}>코치 전용 비밀번호를 입력하세요.</p>
          <input
            type="password"
            placeholder="비밀번호를 입력해주세요."
            value={inputPw}
            onChange={e => setInputPw(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#222', color: '#fff', marginBottom: '16px', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#3FD6A6', color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            대시보드 접속
          </button>
        </form>
      </main>
    );
  }

  const approvedCount = participants.filter(p => p.status === 'approved').length;
  const pendingCount = participants.filter(p => p.status !== 'approved').length;

  return (
    <div className="admin-shell">
      {/* 강의 등록 및 수정 모달 */}
      {editingLecture && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <form onSubmit={handleSaveLecture} style={{ width: '100%', maxWidth: '460px', backgroundColor: '#181818', borderRadius: '16px', border: '1px solid #333', padding: '24px', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>
              {isNewLecture ? '➕ 새 영상 등록' : `Day ${editingLecture.day} 영상 수정`}
            </h3>
            
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>영상 분류</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '8px', border: (!editingLecture.category || editingLecture.category === 'health') ? '1px solid #3FD6A6' : '1px solid #333', backgroundColor: (!editingLecture.category || editingLecture.category === 'health') ? '#3FD6A615' : '#222', cursor: 'pointer', fontSize: '13px', color: '#fff' }}>
                <input
                  type="radio"
                  name="cat"
                  value="health"
                  checked={!editingLecture.category || editingLecture.category === 'health'}
                  onChange={() => setEditingLecture({ ...editingLecture, category: 'health' })}
                  style={{ display: 'none' }}
                />
                🎓 건강 클래스
              </label>

              <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '8px', border: editingLecture.category === 'motivation' ? '1px solid #FF5E3A' : '1px solid #333', backgroundColor: editingLecture.category === 'motivation' ? '#FF5E3A15' : '#222', cursor: 'pointer', fontSize: '13px', color: editingLecture.category === 'motivation' ? '#FF5E3A' : '#fff', fontWeight: 'bold' }}>
                <input
                  type="radio"
                  name="cat"
                  value="motivation"
                  checked={editingLecture.category === 'motivation'}
                  onChange={() => setEditingLecture({ ...editingLecture, category: 'motivation' })}
                  style={{ display: 'none' }}
                />
                🔥 백딱미 (동기부여)
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>오픈 Day (1~100)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingLecture.day || ''}
                  onChange={e => {
                    const d = Number(e.target.value);
                    setEditingLecture({
                      ...editingLecture,
                      day: d,
                      week: `Week ${Math.ceil(d / 7)}`
                    });
                  }}
                  placeholder="예: 8"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>주차 표시</label>
                <input
                  type="text"
                  value={editingLecture.week || ''}
                  onChange={e => setEditingLecture({ ...editingLecture, week: e.target.value })}
                  placeholder="예: Week 2"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>영상 제목</label>
            <input
              type="text"
              value={editingLecture.title || ''}
              onChange={e => setEditingLecture({ ...editingLecture, title: e.target.value })}
              placeholder="예: 2주차 시작: 디톡스를 돕는 물 마시기 비법"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>유튜브 영상 주소 (URL)</label>
            <input
              type="text"
              placeholder="예: https://www.youtube.com/watch?v=..."
              value={editingLecture.video_url || ''}
              onChange={e => setEditingLecture({ ...editingLecture, video_url: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>핵심 요약 / 가이드 문구</label>
            <textarea
              rows={3}
              placeholder="영상에 대한 핵심 설명이나 실천 가이드를 적어주세요."
              value={editingLecture.description || ''}
              onChange={e => setEditingLecture({ ...editingLecture, description: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', marginBottom: '16px', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setEditingLecture(null)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#262626', color: '#aaa', cursor: 'pointer' }}>취소</button>
              <button type="submit" disabled={isSavingLecture} style={{ flex: 1.5, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#3FD6A6', color: '#000', fontWeight: 700, cursor: 'pointer' }}>
                {isSavingLecture ? '저장 중...' : '저장 완료'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 사이드바 (하단 김코치 프로필 배지 제거 완료) */}
      <aside className="admin-sidebar">
        <div className="brand-box">
          <div className="brand-l1">Neuro <span>Cell</span>_Fit</div>
          <div className="brand-l2">ADMIN CONSOLE</div>
        </div>

        <nav className="nav-list">
          <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span className="ic">📊</span>대시보드
          </button>
          <button className={`nav-btn ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
            <span className="ic">🎬</span>콘텐츠 관리
          </button>
          <button className={`nav-btn ${activeTab === 'participants' ? 'active' : ''}`} onClick={() => setActiveTab('participants')}>
            <span className="ic">👥</span>참여자 관리
          </button>
        </nav>
      </aside>

      {/* 본문 */}
      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <section>
            <div className="admin-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1>대시보드</h1>
                <div className="sub">개인별 루틴 진행 현황 · {toKSTDateString()} 기준</div>
              </div>
              <button onClick={() => { fetchParticipants(); fetchCoachNote(); }} className="btn-table">🔄 새로고침</button>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="lab">총 신청 회원</div>
                <div className="val">{participants.length}명</div>
                <div className="delta up">승인: {approvedCount}명</div>
              </div>
              <div className="kpi-card">
                <div className="lab">입금 대기 (승인요망)</div>
                <div className="val" style={{ color: pendingCount > 0 ? '#D9B24C' : 'inherit' }}>{pendingCount}명</div>
                <div className="delta down">{pendingCount > 0 ? '확인 필요' : '대기 없음'}</div>
              </div>
              <div className="kpi-card">
                <div className="lab">진행 중인 참여자</div>
                <div className="val">{approvedCount}명</div>
                <div className="delta up">개인 진도 진행 중</div>
              </div>
            </div>

            {/* 코치 노트 편집 패널 */}
            <div style={{ marginTop: '20px', backgroundColor: '#181818', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#fff' }}>
                  📝 COACH'S NOTE (회원 전체 공지 / 응원 문구)
                </h3>
                <span style={{ fontSize: '11px', color: '#3FD6A6' }}>투데이 탭 하단 실시간 노출</span>
              </div>
              <form onSubmit={handleSaveCoachNote}>
                <textarea
                  rows={2}
                  value={coachNote}
                  onChange={e => setCoachNote(e.target.value)}
                  placeholder="회원들의 투데이 화면에 띄울 오늘의 응원 메시지나 공지사항을 입력해 주세요."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #333',
                    backgroundColor: '#111',
                    color: '#fff',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    outline: 'none',
                    resize: 'none',
                    marginBottom: '10px',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={savingNote}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#3FD6A6',
                      color: '#000',
                      fontWeight: 700,
                      fontSize: '12px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {savingNote ? '저장 중...' : '✓ 코치 노트 업데이트'}
                  </button>
                </div>
              </form>
            </div>

            <div className="two-col" style={{ marginTop: '20px' }}>
              {/* 좌측: 입금 승인 대기 명단 */}
              <div className="panel-box">
                <h3>⚠️ 입금 승인 대기 명단</h3>
                {pendingCount === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '8px' }}>대기 중인 회원이 없습니다.</div>
                ) : (
                  participants.filter(p => p.status !== 'approved').map(p => (
                    <div key={p.id} className="alert-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-mid)' }}>신청일: {p.startDate} ({p.duration}일 코스)</div>
                      </div>
                      <button className="btn-table" style={{ backgroundColor: '#3FD6A6', color: '#000' }} onClick={() => toggleApproval(p)}>
                        승인하기
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* 우측: 🔔 3일 이상 미활동 집중 케어 알림 */}
              <div className="panel-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0 }}>🔔 미인증 집중 케어 알림</h3>
                  <span style={{ fontSize: '11px', color: '#888' }}>3일 이상 미체크</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {inactiveAlerts.length > 0 ? (
                    inactiveAlerts.map(m => (
                      <div
                        key={m.id}
                        onClick={() => setSelectedUser(m)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          backgroundColor: '#241818',
                          borderRadius: '10px',
                          border: '1px solid #ff4d4d33',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '15px' }}>⚠️</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ff6b6b' }}>
                              {m.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                              최근 <strong>{m.inactiveDays}일간</strong> 미션 미인증 (마지막 활동: {m.lastDate})
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#ff8888', backgroundColor: '#ff4d4d22', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                          연락 요망
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '32px 12px', textAlign: 'center', color: '#888', fontSize: '12.5px', lineHeight: 1.6 }}>
                      ✨ 현재 3일 이상 미인증된 회원이 없습니다.<br />
                      모든 참여자가 성실하게 루틴을 이어가고 있습니다!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 콘텐츠 관리 */}
        {activeTab === 'content' && (
          <section>
            <div className="admin-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h1>콘텐츠 관리</h1>
                <div className="sub">클래스 및 백딱미 영상을 직접 등록·관리합니다. (참여자 Day에 맞춰 자동 해금됩니다)</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleOpenNewLectureModal} className="btn-table" style={{ backgroundColor: '#3FD6A6', color: '#000', fontWeight: 700 }}>
                  ➕ 새 영상 등록하기
                </button>
                <button onClick={fetchLectures} className="btn-table">🔄 새로고침</button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '70px' }}>Day</th>
                    <th style={{ width: '120px' }}>분류</th>
                    <th style={{ width: '100px' }}>주차</th>
                    <th>강의/영상 제목</th>
                    <th style={{ width: '110px' }}>영상 상태</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {dayList.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>등록된 영상이 없습니다. [+ 새 영상 등록하기]를 눌러보세요.</td></tr>
                  ) : (
                    dayList.map(d => (
                      <tr key={d.day}>
                        <td><strong>Day {d.day}</strong></td>
                        <td>
                          {d.category === 'motivation' ? (
                            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', backgroundColor: '#FF5E3A22', color: '#FF5E3A', fontWeight: 'bold' }}>
                              🔥 백딱미
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', backgroundColor: '#3FD6A622', color: '#3FD6A6' }}>
                              🎓 클래스
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-mid)' }}>{d.week}</td>
                        <td>{d.title}</td>
                        <td>
                          <span className={`status-pill ${d.video_url ? 'ok' : 'pending'}`}>
                            {d.video_url ? '영상 등록됨' : '영상 미등록'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              className="btn-table"
                              onClick={() => {
                                setEditingLecture(d);
                                setIsNewLecture(false);
                              }}
                            >
                              수정
                            </button>
                            <button
                              className="btn-table"
                              style={{ backgroundColor: '#ff4d4d22', color: '#ff4d4d', border: '1px solid #ff4d4d44' }}
                              onClick={() => handleDeleteLecture(d)}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 참여자 관리 */}
        {activeTab === 'participants' && (
          <section>
            <div className="admin-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h1>참여자 관리</h1>
                <div className="sub">회원별 코스 기간(30일/100일)과 만료를 관리합니다.</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleApproveAll} className="btn-table" style={{ backgroundColor: '#3FD6A6', color: '#000', fontWeight: 700 }}>
                  ✓ 대기자 전체 일괄 승인
                </button>
                <button onClick={handleResetAll} className="btn-table" style={{ backgroundColor: '#ff4d4d', color: '#fff', fontWeight: 600 }}>
                  🚫 전체 일괄 기수종료(초기화)
                </button>
                <button onClick={fetchParticipants} className="btn-table">🔄 새로고침</button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>이름 (닉네임)</th>
                    <th style={{ width: '120px' }}>코스 기간</th>
                    <th>시작(승인)일</th>
                    <th>현재 진행</th>
                    <th>완주 달성일</th>
                    <th>상태</th>
                    <th>승인 관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>로딩 중...</td></tr>
                  ) : participants.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>신청자가 없습니다.</td></tr>
                  ) : (
                    participants.map(p => {
                      const isExpired = p.status === 'approved' && p.currentDay > p.duration;
                      return (
                        <tr key={p.id} onClick={() => setSelectedUser(p)} style={{ cursor: 'pointer' }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="avatar-circle">{p.name[0]}</div>
                              <strong>{p.name}</strong>
                            </div>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <select
                              value={p.duration}
                              onChange={e => handleUpdateDuration(p.id, Number(e.target.value))}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                backgroundColor: '#222',
                                color: p.duration === 100 ? '#FF5E3A' : '#3FD6A6',
                                border: '1px solid #444',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                              }}
                            >
                              <option value={30}>30일 코스</option>
                              <option value={100}>100일 코스</option>
                            </select>
                          </td>
                          <td style={{ color: 'var(--text-mid)' }}>{p.startDate}</td>
                          <td><strong>Day {p.currentDay} / {p.duration}</strong></td>
                          <td style={{ color: 'var(--accent-a)' }}>🔥 {p.streak}일</td>
                          <td>
                            <span className={`status-pill ${p.status === 'approved' && !isExpired ? 'ok' : 'warn'}`}>
                              {p.status === 'approved' ? (isExpired ? `${p.duration}일 만료` : '진행중') : '입금대기'}
                            </span>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <button
                              className="btn-table"
                              style={{
                                backgroundColor: p.status === 'approved' ? '#262626' : '#3FD6A6',
                                color: p.status === 'approved' ? '#888' : '#000',
                                fontWeight: 600,
                              }}
                              onClick={() => toggleApproval(p)}
                            >
                              {p.status === 'approved' ? '승인 취소' : '✓ 승인하기'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* 우측 회원 상세 패널 */}
      {selectedUser && (
        <div className="side-drawer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-mid)' }}>참여자 상세 정보</div>
            <button className="close-btn" onClick={() => setSelectedUser(null)}>✕</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <div className="drawer-av">{selectedUser.name[0]}</div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{selectedUser.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-mid)', marginTop: '2px' }}>
                {selectedUser.startDate} 승인 · <strong>Day {selectedUser.currentDay} / {selectedUser.duration}일 진행 중</strong>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #282828' }}>
            <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>챌린지 코스 기간</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleUpdateDuration(selectedUser.id, 30)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: selectedUser.duration === 30 ? '1px solid #3FD6A6' : '1px solid #333',
                  backgroundColor: selectedUser.duration === 30 ? '#3FD6A615' : '#222',
                  color: selectedUser.duration === 30 ? '#3FD6A6' : '#888',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                30일 코스
              </button>
              <button
                type="button"
                onClick={() => handleUpdateDuration(selectedUser.id, 100)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: selectedUser.duration === 100 ? '1px solid #FF5E3A' : '1px solid #333',
                  backgroundColor: selectedUser.duration === 100 ? '#FF5E3A15' : '#222',
                  color: selectedUser.duration === 100 ? '#FF5E3A' : '#888',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔥 100일 코스
              </button>
            </div>
          </div>

          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #282828', fontSize: '12px' }}>
            <div style={{ color: '#aaa', marginBottom: '4px' }}>신체 설정 정보</div>
            <div style={{ color: '#fff' }}>
              키: <strong>{selectedUser.height ? `${selectedUser.height} cm` : '미입력'}</strong> / 
              목표: <strong>{selectedUser.target_weight ? `${selectedUser.target_weight} kg` : '미입력'}</strong>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              className="btn-primary"
              style={{
                width: '100%',
                backgroundColor: selectedUser.status === 'approved' ? '#333' : '#3FD6A6',
                color: selectedUser.status === 'approved' ? '#fff' : '#000',
              }}
              onClick={() => toggleApproval(selectedUser)}
            >
              {selectedUser.status === 'approved' ? '승인 취소 (미션 로그만 리셋)' : '✓ 승인하기 (Day 1 시작)'}
            </button>
          </div>

          <div style={{ marginTop: '12px', borderTop: '1px solid #262626', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={() => handleDeleteUserCompletely(selectedUser)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                border: '1px solid #ff4d4d',
                color: '#ff4d4d',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⚠️ 회원 완전 탈퇴 (전체 데이터 영구 파기)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}