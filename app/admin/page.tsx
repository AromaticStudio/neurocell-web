'use client';

import React, { useState } from 'react';

// 어머님 원본 Day별 교육 콘텐츠 시드 데이터
const SEED_DAYS = [
  { day: 1, week: '1주차 · 도입', title: '의지력이 아닌 뇌를 속이는 1%의 기적', video: true },
  { day: 2, week: '1주차 · 도입', title: '가짜 배고픔과 코르티솔의 속임수', video: false },
  { day: 3, week: '1주차 · 도입', title: '혈당 스파이크와 지방 저장 스위치', video: false },
  { day: 4, week: '1주차 · 도입', title: '제2의 뇌, 장내 마이크로바이옴', video: false },
  { day: 5, week: '1주차 · 도입', title: '잠든 사이 벌어지는 뇌의 기적, 자가포식', video: false },
  { day: 6, week: '1주차 · 도입', title: '멈춰있는 림프를 뚫어라, 순환과 해독', video: false },
  { day: 7, week: '1주차 · 도입', title: '신경 가소성, 새로운 정체성의 완성', video: false },
];

// 어머님 원본 참여자 시드 데이터
const SEED_PARTICIPANTS = [
  { id: 'u1', name: '은지', startDate: '2026-09-01', currentDay: 7, streak: 7, completion: 88, weight: 54.2, bmi: 21.2, payStatus: 'paid', lastActive: '오늘 접속' },
  { id: 'u2', name: '민준', startDate: '2026-09-01', currentDay: 5, streak: 4, completion: 65, weight: 72.0, bmi: 23.5, payStatus: 'paid', lastActive: '오늘 접속' },
  { id: 'u3', name: '서연', startDate: '2026-08-25', currentDay: 14, streak: 12, completion: 92, weight: 58.1, bmi: 22.0, payStatus: 'paid', lastActive: '오늘 접속' },
  { id: 'u4', name: '지훈', startDate: '2026-09-01', currentDay: 3, streak: 1, completion: 40, weight: 81.5, bmi: 26.1, payStatus: 'expired', lastActive: '3일 전' },
  { id: 'u5', name: '수아', startDate: '2026-09-02', currentDay: 6, streak: 6, completion: 80, weight: 49.8, bmi: 19.5, payStatus: 'paid', lastActive: '오늘 접속' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'content' | 'participants'>('dashboard');
  const [participants, setParticipants] = useState(SEED_PARTICIPANTS);
  const [dayList, setDayList] = useState(SEED_DAYS);
  const [selectedUser, setSelectedUser] = useState<typeof SEED_PARTICIPANTS[0] | null>(null);

  return (
    <div className="admin-shell">
      {/* 사이드바 */}
      <aside className="admin-sidebar">
        <div className="brand-box">
          <div className="brand-l1">Neuro <span>Cell</span>_Fit</div>
          <div className="brand-l2">ADMIN CONSOLE</div>
        </div>

        <nav className="nav-list">
          <button
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="ic">📊</span>대시보드
          </button>
          <button
            className={`nav-btn ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            <span className="ic">🎬</span>콘텐츠 관리
          </button>
          <button
            className={`nav-btn ${activeTab === 'participants' ? 'active' : ''}`}
            onClick={() => setActiveTab('participants')}
          >
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

      {/* 본문 대시보드 */}
      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <section>
            <div className="admin-head">
              <h1>대시보드</h1>
              <div className="sub">전체 참여자 현황을 한눈에 확인하세요 · 2026년 9월 기준</div>
            </div>

            {/* KPI 카드 행 */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="lab">총 참여자</div>
                <div className="val">{participants.length}명</div>
                <div className="delta up">+2 이번 주</div>
              </div>
              <div className="kpi-card">
                <div className="lab">오늘 활성 사용자</div>
                <div className="val">4명</div>
                <div className="delta up">전일 대비 +8%</div>
              </div>
              <div className="kpi-card">
                <div className="lab">평균 미션 달성률</div>
                <div className="val">73%</div>
                <div className="delta down">-2%p</div>
              </div>
              <div className="kpi-card">
                <div className="lab">평균 연속 스트릭</div>
                <div className="val">6.0일</div>
                <div className="delta up">+1.2일</div>
              </div>
              <div className="kpi-card">
                <div className="lab">유료 구독 유지율</div>
                <div className="val">80%</div>
                <div className="delta up">+5%p</div>
              </div>
            </div>

            {/* 위험 신호 박스 & 최근 활동 */}
            <div className="two-col" style={{ marginTop: '20px' }}>
              <div className="panel-box">
                <h3>⚠️ 주의가 필요한 참여자</h3>
                <div className="alert-item">
                  <div>
                    <div style={{ fontWeight: 'bold' }}>지훈</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-mid)', marginTop: '2px' }}>
                      3일째 미접속 · Day 3에서 멈춤
                    </div>
                  </div>
                  <span className="pill-warn">관리 요망</span>
                </div>
              </div>

              <div className="panel-box">
                <h3>최근 인증 활동</h3>
                <div className="feed-item">
                  <div className="dot"></div>
                  <div style={{ fontSize: '12.5px' }}>
                    <strong>은지</strong>님이 Day 7 루틴을 올클리어했어요
                  </div>
                  <span className="time-lbl">방금 전</span>
                </div>
                <div className="feed-item">
                  <div className="dot"></div>
                  <div style={{ fontSize: '12.5px' }}>
                    <strong>수아</strong>님이 아침 기상 인증을 완료했어요
                  </div>
                  <span className="time-lbl">1시간 전</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 콘텐츠 관리 탭 */}
        {activeTab === 'content' && (
          <section>
            <div className="admin-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>콘텐츠 관리</h1>
                <div className="sub">Day별 교육 자료를 등록·수정합니다. 저장하면 참여자 웹에 즉시 반영됩니다.</div>
              </div>
              <button className="btn-primary" onClick={() => alert('새 Day 추가 팝업 기능 준비 중')}>+ 새 Day 추가</button>
            </div>

            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Day</th>
                    <th style={{ width: '140px' }}>주차</th>
                    <th>제목</th>
                    <th style={{ width: '120px' }}>영상 상태</th>
                    <th style={{ width: '120px' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {dayList.map(d => (
                    <tr key={d.day}>
                      <td><strong>Day {d.day}</strong></td>
                      <td style={{ color: 'var(--text-mid)' }}>{d.week}</td>
                      <td>{d.title}</td>
                      <td>
                        <span className={`status-pill ${d.video ? 'ok' : 'pending'}`}>
                          {d.video ? '영상 완료' : '영상 준비중'}
                        </span>
                      </td>
                      <td>
                        <button className="btn-table" onClick={() => alert(`Day ${d.day} 편집`)}>수정</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 참여자 관리 탭 */}
        {activeTab === 'participants' && (
          <section>
            <div className="admin-head">
              <h1>참여자 관리</h1>
              <div className="sub">참여자별 진행 상황, 체중 기록, 결제 상태를 확인합니다.</div>
            </div>

            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>시작일</th>
                    <th>현재 Day</th>
                    <th>스트릭</th>
                    <th>달성률</th>
                    <th>체중 / BMI</th>
                    <th>결제 상태</th>
                    <th>접속 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.id} onClick={() => setSelectedUser(p)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="avatar-circle">{p.name[0]}</div>
                          <strong>{p.name}</strong>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-mid)' }}>{p.startDate}</td>
                      <td><strong>Day {p.currentDay}</strong></td>
                      <td style={{ color: 'var(--accent-a)' }}>🔥 {p.streak}일</td>
                      <td>{p.completion}%</td>
                      <td>{p.weight}kg · {p.bmi}</td>
                      <td>
                        <span className={`status-pill ${p.payStatus === 'paid' ? 'ok' : 'warn'}`}>
                          {p.payStatus === 'paid' ? '결제완료' : '만료/미결제'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${p.lastActive === '오늘 접속' ? 'ok' : 'warn'}`}>
                          {p.lastActive}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* 우측 회원 상세 슬라이드 패널 */}
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
                {selectedUser.startDate} 시작 · Day {selectedUser.currentDay} 진행 중
              </div>
            </div>
          </div>

          <div className="drawer-stats">
            <div className="stat-box">
              <div className="v">🔥 {selectedUser.streak}일</div>
              <div className="l">STREAK</div>
            </div>
            <div className="stat-box">
              <div className="v">{selectedUser.completion}%</div>
              <div className="l">달성률</div>
            </div>
            <div className="stat-box">
              <div className="v">{selectedUser.weight}kg</div>
              <div className="l">체중 (BMI {selectedUser.bmi})</div>
            </div>
          </div>

          <div className="panel-box" style={{ marginTop: '18px' }}>
            <h3 style={{ fontSize: '12.5px', marginBottom: '8px' }}>코치 전용 메모 (회원 비공개)</h3>
            <textarea
              className="coach-textarea"
              placeholder="예: 수분 섭취 루틴에 어려움이 있어 카톡으로 격려 필요."
              defaultValue=""
            />
            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={() => alert('메모가 저장되었습니다')}
            >
              메모 저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}