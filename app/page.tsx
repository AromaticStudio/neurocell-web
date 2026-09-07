'use client';

import React, { useState } from 'react';

const INITIAL_MISSIONS = [
  { id: 'water', group: 'essential', icon: '💧', title: '수분섭취 · Water Intake', sub: '하루 1.5~2L', done: false },
  { id: 'juice', group: 'essential', icon: '🥤', title: 'PM 주스 섭취 · PM Juice', sub: '파워칵테일 · 액티바이즈', done: false },
  { id: 'diet', group: 'essential', icon: '🥗', title: '식단 관리 · Diet Control', sub: '탄수화물 절반, 저녁 쉐이크', done: false },
  { id: 'walk', group: 'essential', icon: '🚶', title: '걷기 · Walk 15min+', sub: '식후 가벼운 산책', done: false },
  { id: 'sun', group: 'essential', icon: '☀️', title: '햇볕보기 · Get Sunlight', sub: '야외 10분 이상', done: false },
  { id: 'wake', group: 'wellbeing', icon: '⏰', title: '기상 체크 · Wake‑up', sub: '06:00 기상 인증', done: false },
  { id: 'oil', group: 'wellbeing', icon: '🦷', title: '오일풀링 · Oil Pulling', sub: '공복 10~15분', done: false },
  { id: 'journal', group: 'wellbeing', icon: '📓', title: '감사일기 · Gratitude Journal', sub: '하루 3줄 기록', done: false },
  { id: 'med', group: 'wellbeing', icon: '🧘', title: '명상 · Meditation', sub: '5~10분 호흡 명상', done: false },
  { id: 'sleep', group: 'wellbeing', icon: '🌙', title: '숙면 관리 · Sleep Care', sub: '족욕 + 리스토레이트', done: false },
];

export default function Home() {
  const [currentTab, setCurrentTab] = useState<'today' | 'class' | 'record'>('today');
  const [missions, setMissions] = useState(INITIAL_MISSIONS);
  const [streak, setStreak] = useState(1);
  const [confettis, setConfettis] = useState<any[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  const toggleMission = (id: string) => {
    setMissions(prev => {
      const updated = prev.map(m => (m.id === id ? { ...m, done: !m.done } : m));
      const allDone = updated.every(m => m.done);

      if (allDone && !hasCelebrated) {
        setHasCelebrated(true);
        setStreak(s => s + 1);
        fireConfetti();
      } else if (!allDone && hasCelebrated) {
        setHasCelebrated(false);
        setStreak(s => Math.max(1, s - 1));
      }
      return updated;
    });
  };

  const fireConfetti = () => {
    const colors = ['#D9B24C', '#3FD6A6'];
    const pieces = Array.from({ length: 32 }, (_, i) => ({
      id: Date.now() + i,
      left: `${10 + Math.random() * 80}%`,
      bg: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 6,
      rot: `${Math.random() * 360}deg`,
      duration: 1.4 + Math.random() * 0.8,
      delay: Math.random() * 0.2,
    }));
    setConfettis(pieces);
    setShowCelebration(true);

    setTimeout(() => setConfettis([]), 2600);
    setTimeout(() => setShowCelebration(false), 2400);
  };

  const essentialMissions = missions.filter(m => m.group === 'essential');
  const essentialDone = essentialMissions.filter(m => m.done).length;

  const wellbeingMissions = missions.filter(m => m.group === 'wellbeing');
  const wellbeingDone = wellbeingMissions.filter(m => m.done).length;
  const totalPercent = Math.round(((essentialDone + wellbeingDone) / missions.length) * 100);

  return (
    <main className="app-shell">
      <div className="device-screen">
        
        {/* 폭죽 및 빵빠레 팝업 */}
        {confettis.map(c => (
          <div
            key={c.id}
            className="confetti-piece"
            style={{
              left: c.left,
              width: `${c.size}px`,
              height: `${c.size * 1.6}px`,
              backgroundColor: c.bg,
              transform: `rotate(${c.rot})`,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}

        {showCelebration && (
          <div className="toast-center">
            <div style={{ fontSize: '32px' }}>🎉</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '6px' }}>오늘 미션 올클리어!</div>
            <div style={{ fontSize: '11px', color: 'var(--text-mid)', marginTop: '4px' }}>세포가 반응하기 시작했어요</div>
          </div>
        )}

        {/* 상단 바 */}
        <div className="top-header">
          <span>Neuro Cell_Fit</span>
          <span style={{ color: 'var(--accent-a)' }}>28일 챌린지</span>
        </div>

        {/* 스크롤 본문 */}
        <div className="scroll-body">
          {currentTab === 'today' && (
            <>
              <div className="greeting">
                <div className="date">2026년 9월 8일 · TUE</div>
                <h1>안녕하세요, <em>참여자</em>님 👋</h1>
              </div>

              <div className="status-strip">
                <div className="cell">
                  <div className="num">Day 1</div>
                  <div className="lab">CHALLENGE</div>
                </div>
                <div className="cell">
                  <div className="num" style={{ color: 'var(--accent-a)' }}>🔥 {streak}</div>
                  <div className="lab">DAY STREAK</div>
                </div>
                <div className="cell">
                  <div className="num" style={{ color: 'var(--accent-b)' }}>{totalPercent}%</div>
                  <div className="lab">COMPLETION</div>
                </div>
              </div>

              <div className="lecture-hero">
                <div className="daytag">DAY 1</div>
                <h3 className="ttl">의지력이 아닌 뇌를 속이는 1%의 기적</h3>
                <div className="sub">"다이어트, 매번 의지력 부족으로 실패하셨나요? 여러분의 잘못이 아닙니다."</div>
              </div>

              {/* 필수 루틴 */}
              <div className="mission-card">
                <div className="mission-head">
                  <h2>필수 루틴 · Essential</h2>
                  <div className="cnt">{essentialDone}/{essentialMissions.length}</div>
                </div>
                <div className="mission-progress">
                  <div className="track">
                    <div className="fill" style={{ width: `${(essentialDone / essentialMissions.length) * 100}%` }} />
                  </div>
                </div>
                <div className="mission-list">
                  {essentialMissions.map(m => (
                    <div
                      key={m.id}
                      className={`mission-row ${m.done ? 'done' : ''}`}
                      onClick={() => toggleMission(m.id)}
                    >
                      <div className="m-ic">{m.icon}</div>
                      <div className="m-txt">
                        <div className="m-t">{m.title}</div>
                        <div className="m-s">{m.sub}</div>
                      </div>
                      <div className="m-chk">✓</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 웰빙 루틴 */}
              <div className="mission-card">
                <div className="mission-head">
                  <h2>웰빙 루틴 · Wellbeing</h2>
                  <div className="cnt" style={{ color: 'var(--accent-b)' }}>{wellbeingDone}/{wellbeingMissions.length}</div>
                </div>
                <div className="mission-progress">
                  <div className="track">
                    <div className="fill" style={{ width: `${(wellbeingDone / wellbeingMissions.length) * 100}%` }} />
                  </div>
                </div>
                <div className="mission-list">
                  {wellbeingMissions.map(m => (
                    <div
                      key={m.id}
                      className={`mission-row ${m.done ? 'done' : ''}`}
                      onClick={() => toggleMission(m.id)}
                    >
                      <div className="m-ic">{m.icon}</div>
                      <div className="m-txt">
                        <div className="m-t">{m.title}</div>
                        <div className="m-s">{m.sub}</div>
                      </div>
                      <div className="m-chk">✓</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 코치 노트 */}
              <div className="msg-card">
                <div className="k">COACH'S NOTE · 매일 업데이트</div>
                <p>가짜 배고픔은 뇌가 만든 착각이에요. 오늘도 나 자신을 믿고 루틴을 지켜봐요 🌤️</p>
              </div>
            </>
          )}

          {currentTab === 'class' && (
            <div style={{ padding: '20px 0' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Class · 강의 보관함</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '6px' }}>28일 커리큘럼 강의가 준비되는 공간입니다.</p>
            </div>
          )}

          {currentTab === 'record' && (
            <div style={{ padding: '20px 0' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>My Record · 나의 기록</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '6px' }}>체중과 눈바디 사진을 기록하는 공간입니다.</p>
            </div>
          )}
        </div>

        {/* 하단 고정 탭바 */}
        <div className="tabbar">
          <button
            className={`tab-item ${currentTab === 'today' ? 'active' : ''}`}
            onClick={() => setCurrentTab('today')}
          >
            <span className="ic">🎯</span>
            투데이
          </button>
          <button
            className={`tab-item ${currentTab === 'class' ? 'active' : ''}`}
            onClick={() => setCurrentTab('class')}
          >
            <span className="ic">🎬</span>
            클래스
          </button>
          <button
            className={`tab-item ${currentTab === 'record' ? 'active' : ''}`}
            onClick={() => setCurrentTab('record')}
          >
            <span className="ic">📈</span>
            나의 기록
          </button>
        </div>

      </div>
    </main>
  );
}