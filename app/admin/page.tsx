'use client';

import React, { useState, useEffect } from 'react';
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
  const [dayList, setDayList] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 강의 수정 모달 상태
  const [editingLecture, setEditingLecture] = useState<any>(null);
  const [isSavingLecture, setIsSavingLecture] = useState(false);

  // 강의 목록 불러오기
  const fetchLectures = async () => {
    const { data } = await supabase.from('lectures').select('*').order('day', { ascending: true });
    if (data) setDayList(data);
  };

  // 회원 목록 불러오기 (미션 완료 일수 실시간 집계 연동)
  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const [{ data: profilesData, error: pError }, { data: missionLogsData }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('mission_logs').select('user_id, log_date, completed').eq('completed', true),
      ]);

      if (!pError && profilesData) {
        // 회원별 완주(10개 올클리어한 날) 일수 집계
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

          return {
            id: p.id,
            name: p.nickname || `참여자 ${idx + 1}`,
            startDate: p.approved_at ? toKSTDateString(p.approved_at) : (p.created_at ? toKSTDateString(p.created_at) : '-'),
            currentDay,
            streak: realCompletedDays,
            status: p.status || 'pending',
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

  // 1. 승인 / 승인 취소 (취소 시 mission_logs만 자동 초기화, 신체/체중 데이터는 보존)
  const toggleApproval = async (user: any) => {
    const isCancelling = user.status === 'approved';

    if (isCancelling) {
      const ok = confirm(
        `[승인 취소 / 기수 종료]\n\n` +
        `'${user.name}' 회원의 승인을 취소하시겠습니까?\n` +
        `• 30일 루틴 체크(미션 로그)는 다음 기수를 위해 초기화됩니다.\n` +
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
      // 1) 프로필 상태 업데이트
      const { error: pError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (pError) throw pError;

      // 2) 승인 취소인 경우 미션 로그만 삭제 (체중 기록 weight_records는 그대로 유지!)
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

  // 2. 완전 탈퇴 처리 (영구 삭제: mission_logs, weight_records, profiles 전부 파기)
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
      // 1) 미션 로그 삭제
      await supabase.from('mission_logs').delete().eq('user_id', user.id);
      // 2) 체중 기록 삭제
      await supabase.from('weight_records').delete().eq('user_id', user.id);
      // 3) 프로필 삭제
      const { error: profError } = await supabase.from('profiles').delete().eq('id', user.id);

      if (profError) throw profError;

      alert(`${user.name} 회원의 모든 데이터가 영구 파기(탈퇴 처리)되었습니다.`);
      setSelectedUser(null);
      await fetchParticipants();
    } catch (err: any) {
      alert(`탈퇴 처리 실패: ${err.message}`);
    }
  };

  // 대기자 전체 일괄 승인
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

  // 기수 종료: 전체 일괄 취소 (승인된 회원의 미션 로그 일괄 정리)
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

      // 프로필 비승인 전환
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'pending', approved_at: null })
        .in('id', approvedIds);

      if (error) throw error;

      // 미션 로그만 일괄 삭제
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

  // 강의 내용 저장
  const handleSaveLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLecture) return;
    setIsSavingLecture(true);

    try {
      const { error } = await supabase
        .from('lectures')
        .upsert({
          day: editingLecture.day,
          week: editingLecture.week,
          title: editingLecture.title,
          video_url: editingLecture.video_url,
          description: editingLecture.description,
        });

      if (error) {
        alert(`저장 실패: ${error.message}`);
      } else {
        alert(`Day ${editingLecture.day} 강의가 저장되었습니다.`);
        setEditingLecture(null);
        fetchLectures();
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setIsSavingLecture(false);
    }
  };

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
      {/* 강의 수정 모달 */}
      {editingLecture && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <form onSubmit={handleSaveLecture} style={{ width: '100%', maxWidth: '440px', backgroundColor: '#181818', borderRadius: '16px', border: '1px solid #333', padding: '24px', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>
              Day {editingLecture.day} 강의 설정
            </h3>
            
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>강의 제목</label>
            <input
              type="text"
              value={editingLecture.title || ''}
              onChange={e => setEditingLecture({ ...editingLecture, title: e.target.value })}
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

      {/* 사이드바 */}
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

        <div className="sidebar-foot">
          <div className="coach-badge">
            <div className="coach-av">코</div>
            <div>
              <div className="coach-nm">김코치</div>
              <div className="coach-rl">Head Coach</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 본문 */}
      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <section>
            <div className="admin-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1>대시보드</h1>
                <div className="sub">개인별 30일 루틴 진행 현황 · {toKSTDateString()} 기준</div>
              </div>
              <button onClick={fetchParticipants} className="btn-table">🔄 새로고침</button>
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

            <div className="two-col" style={{ marginTop: '20px' }}>
              <div className="panel-box">
                <h3>⚠️ 입금 승인 대기 명단</h3>
                {pendingCount === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '8px' }}>대기 중인 회원이 없습니다.</div>
                ) : (
                  participants.filter(p => p.status !== 'approved').map(p => (
                    <div key={p.id} className="alert-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-mid)' }}>신청일: {p.startDate}</div>
                      </div>
                      <button className="btn-table" style={{ backgroundColor: '#3FD6A6', color: '#000' }} onClick={() => toggleApproval(p)}>
                        승인하기
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="panel-box">
                <h3>최근 인증 활동</h3>
                <div className="feed-item">
                  <div className="dot"></div>
                  <div style={{ fontSize: '12.5px' }}><strong>회원 시스템</strong>이 정상 가동 중입니다.</div>
                  <span className="time-lbl">실시간</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 콘텐츠 관리 */}
        {activeTab === 'content' && (
          <section>
            <div className="admin-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>콘텐츠 관리</h1>
                <div className="sub">Day별 유튜브 영상과 강의 자료를 등록·수정합니다. (참여자 Day에 맞춰 누적 오픈됩니다)</div>
              </div>
              <button onClick={fetchLectures} className="btn-table">🔄 새로고침</button>
            </div>

            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Day</th>
                    <th style={{ width: '130px' }}>주차</th>
                    <th>강의 제목</th>
                    <th style={{ width: '120px' }}>영상 상태</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {dayList.map(d => (
                    <tr key={d.day}>
                      <td><strong>Day {d.day}</strong></td>
                      <td style={{ color: 'var(--text-mid)' }}>{d.week}</td>
                      <td>{d.title}</td>
                      <td>
                        <span className={`status-pill ${d.video_url ? 'ok' : 'pending'}`}>
                          {d.video_url ? '영상 등록됨' : '영상 미등록'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn-table" onClick={() => setEditingLecture(d)}>수정</button>
                      </td>
                    </tr>
                  ))}
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
                <div className="sub">개인별 시작일 기준 현재 진행 Day와 만료(30일)를 관리합니다.</div>
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
                    <th>시작(승인)일</th>
                    <th>현재 진행</th>
                    <th>완주 달성일</th>
                    <th>상태</th>
                    <th>승인 관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>로딩 중...</td></tr>
                  ) : participants.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>신청자가 없습니다.</td></tr>
                  ) : (
                    participants.map(p => (
                      <tr key={p.id} onClick={() => setSelectedUser(p)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="avatar-circle">{p.name[0]}</div>
                            <strong>{p.name}</strong>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-mid)' }}>{p.startDate}</td>
                        <td><strong>Day {p.currentDay} / 30</strong></td>
                        <td style={{ color: 'var(--accent-a)' }}>🔥 {p.streak}일</td>
                        <td>
                          <span className={`status-pill ${p.status === 'approved' ? 'ok' : 'warn'}`}>
                            {p.status === 'approved' ? (p.currentDay > 30 ? '30일만료' : '진행중') : '입금대기'}
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
                    ))
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
                {selectedUser.startDate} 승인 · <strong>Day {selectedUser.currentDay} 진행 중</strong>
              </div>
            </div>
          </div>

          {/* 신체 정보 요약 표시 */}
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #282828', fontSize: '12px' }}>
            <div style={{ color: '#aaa', marginBottom: '4px' }}>신체 설정 정보</div>
            <div style={{ color: '#fff' }}>
              키: <strong>{selectedUser.height ? `${selectedUser.height} cm` : '미입력'}</strong> / 
              목표: <strong>{selectedUser.target_weight ? `${selectedUser.target_weight} kg` : '미입력'}</strong>
            </div>
          </div>

          {/* 버튼 1: 단순 승인 토글 (미션 로그만 초기화, 신체 기록 유지) */}
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

          {/* 버튼 2: 회원 영구 탈퇴 및 데이터 영구 파기 */}
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
                transition: 'all 0.2s',
              }}
            >
              ⚠️ 회원 완전 탈퇴 (전체 데이터 영구 파기)
            </button>
            <p style={{ fontSize: '10px', color: '#666', marginTop: '6px', textAlign: 'center', lineHeight: 1.4 }}>
              탈퇴 요청 시 사용하며, 프로필 및 모든 체중/루틴 기록이 즉시 영구 삭제됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}