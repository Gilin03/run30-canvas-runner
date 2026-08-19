import { useEffect, useRef, useState } from "react";
import "./App.css";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 330;

const GAME_DURATION = 30;

// 플레이어
const PLAYER_X = 100;
const PLAYER_WIDTH = 42;
const PLAYER_HEIGHT = 52;
const CROUCH_HEIGHT = 30;

// 물리
const GRAVITY = 0.7;
const JUMP_POWER = -10.5;

const SPEED_INCREASE = 0.2;

// 장애물
const DIFFICULTY_SETTINGS = {
  basic: {
    name: "기본",
    startSpeed: 7,
    maxSpeed: 13,
  },

  easy: {
    name: "움직임 줄이기",
    startSpeed: 5,
    maxSpeed: 10,
  },
};

// 장애물 생성 간격
const MIN_SPAWN_TIME = 650;
const MAX_SPAWN_TIME = 1250;

function App() {
  const canvasRef = useRef(null);
  const difficultyRef = useRef("basic");

  const keysRef = useRef({
    down: false,
  });

  const playerRef = useRef({
    y: GROUND_Y - PLAYER_HEIGHT,
    velocityY: 0,
    isJumping: false,
  });

  const obstaclesRef = useRef([]);

  const spawnTimerRef = useRef(0);
  const nextSpawnTimeRef = useRef(1200);

  const lastTimeRef = useRef(0);
  const animationRef = useRef(null);

  const deathParticlesRef = useRef([]);
  const [isShaking, setIsShaking] = useState(false);

  const elapsedTimeRef = useRef(0);
  const gameStartTimeRef = useRef(0);

  const lastObstacleTypeRef = useRef(null);

  const gameStateRef = useRef("PLAYING");

  const pauseStartTimeRef = useRef(null);

  const [gameState, setGameState] = useState("PLAYING");
  const [elapsedTime, setElapsedTime] = useState(0);

  const [difficulty, setDifficulty] = useState("basic");
  const [showRecords, setShowRecords] = useState(false);

  const changeDifficulty = (value) => {
    difficultyRef.current = value;
    setDifficulty(value);
  };

  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem("run30-records");

      if (!saved) {
        return {
          basic: [],
          easy: [],
        };
      }

      const parsed = JSON.parse(saved);

      if (
        !parsed ||
        !Array.isArray(parsed.basic) ||
        !Array.isArray(parsed.easy)
      ) {
        return {
          basic: [],
          easy: [],
        };
      }

      return {
        basic: parsed.basic.slice(0, 10),
        easy: parsed.easy.slice(0, 10),
      };
    } catch {
      return {
        basic: [],
        easy: [],
      };
    }
  });
  // -----------------------------
  // 키보드
  // -----------------------------

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.code === "Space" ||
        event.code === "ArrowUp" ||
        event.code === "ArrowDown"
      ) {
        event.preventDefault();
      }

      const player = playerRef.current;

      // 점프
      if (event.code === "Space" || event.code === "ArrowUp") {
        if (
          gameStateRef.current === "PLAYING" &&
          !player.isJumping &&
          !keysRef.current.down
        ) {
          player.velocityY = JUMP_POWER;
          player.isJumping = true;
        }
      }

      // 숙이기
      if (event.code === "ArrowDown") {
        keysRef.current.down = true;
      }

      // 일시정지
if (event.code === "KeyP") {
  if (
    gameStateRef.current === "PLAYING"
  ) {
    pauseStartTimeRef.current =
      performance.now();

    gameStateRef.current = "PAUSED";
    setGameState("PAUSED");
  } else if (
    gameStateRef.current === "PAUSED"
  ) {
    const pausedTime =
      performance.now() -
      pauseStartTimeRef.current;

    gameStartTimeRef.current +=
      pausedTime;

    pauseStartTimeRef.current = null;

    gameStateRef.current = "PLAYING";
    setGameState("PLAYING");
  }

  return;
}

      // 재시작
      if (event.code === "KeyR") {
        restartGame();
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === "ArrowDown") {
        keysRef.current.down = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const saveRecord = (time, result) => {
    setRecords((prev) => {
      const currentDifficulty = difficultyRef.current;

      const updated = {
        ...prev,
        [currentDifficulty]: [
          ...prev[currentDifficulty],
          {
            time: Number(time.toFixed(1)),
            result,
          },
        ].slice(0, 10),
      };

      localStorage.setItem("run30-records", JSON.stringify(updated));

      return updated;
    });
  };

  const clearRecords = (type) => {
    setRecords((prev) => {
      const updated = {
        ...prev,
        [type]: [],
      };

      localStorage.setItem("run30-records", JSON.stringify(updated));

      return updated;
    });
  };

  const playDeathEffect = (x, y) => {
    deathParticlesRef.current = Array.from({ length: 16 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 16;

      const speed = 3 + Math.random() * 3;

      return {
        id: `${Date.now()}-${index}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 3,
        life: 4,
      };
    });

    console.log("파티클 생성:", deathParticlesRef.current);

    if (difficultyRef.current === "basic") {
      setIsShaking(true);

      setTimeout(() => {
        setIsShaking(false);
      }, 250);
    }
  };
  // -----------------------------
  // 게임 재시작
  // -----------------------------

  const restartGame = () => {
    playerRef.current = {
      y: GROUND_Y - PLAYER_HEIGHT,
      velocityY: 0,
      isJumping: false,
    };

    obstaclesRef.current = [];

    spawnTimerRef.current = 0;
    elapsedTimeRef.current = 0;
    setElapsedTime(0);
    gameStartTimeRef.current = performance.now();

    pauseStartTimeRef.current = null;

    // 처음 장애물은 조금 늦게
    nextSpawnTimeRef.current = 1300;

    lastObstacleTypeRef.current = null;

    gameStateRef.current = "PLAYING";
    setGameState("PLAYING");
  };

  // -----------------------------
  // 게임 루프
  // -----------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    gameStartTimeRef.current = performance.now();

    // -----------------------------
    // 랜덤 장애물 선택
    // -----------------------------

    const getObstacleType = () => {
      const random = Math.random();

      let type;

      // 공중 장애물은 약 30%
      if (random < 0.3) {
        type = Math.random() < 0.5 ? "drone" : "laser";
      } else {
        type =
          Math.random() < 0.45
            ? "smallRock"
            : Math.random() < 0.5
              ? "bigRock"
              : "cactus";
      }

      // 같은 공중 장애물이 연속으로 나오지 않게
      if (
        type === lastObstacleTypeRef.current &&
        (type === "drone" || type === "laser")
      ) {
        type = "smallRock";
      }

      return type;
    };

    // -----------------------------
    // 장애물 생성
    // -----------------------------

    const createObstacle = () => {
      const type = getObstacleType();

      lastObstacleTypeRef.current = type;

      const obstacleData = {
        smallRock: {
          width: 28,
          height: 32,
          y: GROUND_Y - 32,
        },

        bigRock: {
          width: 42,
          height: 52,
          y: GROUND_Y - 52,
        },

        cactus: {
          width: 34,
          height: 62,
          y: GROUND_Y - 62,
        },

        // 공중 장애물
        // 아래쪽이 약 278에 오도록 해서
        // 점프 중에도 충돌할 수 있게 함
        drone: {
          width: 58,
          height: 78,
          y: 225,
        },

        laser: {
          width: 86,
          height: 68,
          y: 225,
        },
      };

      const data = obstacleData[type];

      return {
        x: CANVAS_WIDTH + 40,
        width: data.width,
        height: data.height,
        y: data.y,
        type,
      };
    };

    // -----------------------------
    // 다음 장애물까지 거리
    // -----------------------------

    const getNextSpawnTime = () => {
  const patterns = [
    500, 550, 600, 650,
    750, 850, 950
  ]

  return patterns[
    Math.floor(
      Math.random() * patterns.length
    )
  ]
};
    // -----------------------------
    // 충돌 판정
    // -----------------------------

    const checkCollision = (player, obstacle) => {
      const crouching = keysRef.current.down;

      const playerHeight = crouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;

      const playerTop = player.y + (PLAYER_HEIGHT - playerHeight);

      const playerBottom = playerTop + playerHeight;

      const playerLeft = PLAYER_X + 8;
      const playerRight = PLAYER_X + PLAYER_WIDTH - 8;

      const obstacleLeft = obstacle.x + 3;
      const obstacleRight = obstacle.x + obstacle.width - 3;

      const obstacleTop = obstacle.y;
      const obstacleBottom = obstacle.y + obstacle.height;

      const horizontalCollision =
        playerRight > obstacleLeft && playerLeft < obstacleRight;

      if (!horizontalCollision) {
        return false;
      }

      // 숙이고 있는 동안 공중 장애물 통과
      if (
        crouching &&
        (obstacle.type === "drone" || obstacle.type === "laser")
      ) {
        return false;
      }

      const verticalCollision =
        playerBottom > obstacleTop && playerTop < obstacleBottom;

      return verticalCollision;
    };
    // -----------------------------
    // 플레이어 그리기
    // -----------------------------

    const drawPlayer = () => {
      const player = playerRef.current;
      const crouching = keysRef.current.down;

      const height = crouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;

      const x = PLAYER_X;

      const y = player.y + (PLAYER_HEIGHT - height);

      // 몸
      context.fillStyle = "#222";

      context.fillRect(x, y, PLAYER_WIDTH, height);

      // 눈
      context.fillStyle = "#fff";

      context.fillRect(x + 29, y + 10, 5, 5);

      // 다리
      if (!crouching) {
        context.fillStyle = "#222";

        context.fillRect(x + 7, y + height, 8, 7);

        context.fillRect(x + 27, y + height, 8, 7);
      }
    };

    // -----------------------------
    // 장애물 그리기
    // -----------------------------

    const drawObstacle = (obstacle) => {
      context.fillStyle = "#222";

      // 작은 바위
      if (obstacle.type === "smallRock") {
        context.fillRect(obstacle.x + 5, obstacle.y + 8, 18, 24);

        context.fillRect(obstacle.x, obstacle.y + 15, 28, 17);
      }

      // 큰 바위
      if (obstacle.type === "bigRock") {
        context.fillRect(obstacle.x + 6, obstacle.y + 8, 30, 44);

        context.fillRect(obstacle.x, obstacle.y + 20, 42, 32);
      }

      // 선인장
      if (obstacle.type === "cactus") {
        context.fillRect(obstacle.x + 10, obstacle.y, 13, 62);

        context.fillRect(obstacle.x, obstacle.y + 20, 12, 9);

        context.fillRect(obstacle.x + 23, obstacle.y + 32, 11, 9);
      }

      // 드론
      if (obstacle.type === "drone") {
        // 몸체
        context.fillRect(obstacle.x + 8, obstacle.y + 24, 42, 30);

        // 날개
        context.fillRect(obstacle.x, obstacle.y + 14, 14, 8);

        context.fillRect(obstacle.x + 44, obstacle.y + 14, 14, 8);

        // 위쪽 부분
        context.fillRect(obstacle.x + 16, obstacle.y + 5, 26, 12);
      }

      // 레이저
      if (obstacle.type === "laser") {
        context.fillRect(obstacle.x, obstacle.y + 20, obstacle.width, 20);

        context.fillRect(obstacle.x + 8, obstacle.y, 10, 68);

        context.fillRect(obstacle.x + obstacle.width - 18, obstacle.y, 10, 68);
      }
    };

    // -----------------------------
    // 게임 루프
    // -----------------------------

    const gameLoop = (time) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
      }

      const deltaMs = time - lastTimeRef.current;

      lastTimeRef.current = time;

      const deltaFrames = Math.min(deltaMs / 16.67, 2);

      // -----------------------------
      // 배경
      // -----------------------------

      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      context.fillStyle = "#f5f5f5";

      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // -----------------------------
      // 게임 진행
      // -----------------------------

      if (gameStateRef.current === "PLAYING") {
        const player = playerRef.current;

        // 점프 물리
        player.y += player.velocityY * deltaFrames;

        player.velocityY += GRAVITY * deltaFrames;

        // 바닥 착지
        if (player.y >= GROUND_Y - PLAYER_HEIGHT) {
          player.y = GROUND_Y - PLAYER_HEIGHT;

          player.velocityY = 0;

          player.isJumping = false;
        }

        // -----------------------------
        // 장애물 생성
        // -----------------------------

        spawnTimerRef.current += deltaMs;

        if (spawnTimerRef.current >= nextSpawnTimeRef.current) {
          const newObstacle = createObstacle();

          // 바로 앞 장애물과 너무 가까우면
          // 생성 시간을 조금 늦춤
          const lastObstacle =
            obstaclesRef.current[obstaclesRef.current.length - 1];

          if (!lastObstacle || lastObstacle.x < 520) {
            obstaclesRef.current.push(newObstacle);

            spawnTimerRef.current = 0;

            nextSpawnTimeRef.current = getNextSpawnTime();
          } else {
            spawnTimerRef.current = nextSpawnTimeRef.current - 150;
          }
        }

        // -----------------------------
        // 장애물 이동
        // -----------------------------

        // 게임 플레이 시

        // 시간이 지날수록 장애물 속도 증가
        const currentTime = Math.min(
          (time - gameStartTimeRef.current) / 1000,
          GAME_DURATION,
        );

        elapsedTimeRef.current = currentTime;

        setElapsedTime(currentTime);

        if (
          elapsedTimeRef.current >= GAME_DURATION &&
          gameStateRef.current === "PLAYING"
        ) {
          elapsedTimeRef.current = GAME_DURATION;

          gameStateRef.current = "CLEAR";
          setGameState("CLEAR");

          saveRecord(GAME_DURATION, "CLEAR");
        }

        const currentDifficulty = DIFFICULTY_SETTINGS[difficultyRef.current];

        const currentSpeed = Math.min(
          currentDifficulty.startSpeed +
            elapsedTimeRef.current * SPEED_INCREASE,
          currentDifficulty.maxSpeed,
        );

        // 장애물 이동
        obstaclesRef.current.forEach((obstacle) => {
          obstacle.x -= currentSpeed * deltaFrames;
        });

        // 화면 밖 제거
        obstaclesRef.current = obstaclesRef.current.filter(
          (obstacle) => obstacle.x + obstacle.width > -40,
        );

        // -----------------------------
        // 충돌
        // -----------------------------

        for (const obstacle of obstaclesRef.current) {
          if (checkCollision(player, obstacle)) {
            playDeathEffect(
              PLAYER_X + PLAYER_WIDTH / 2,
              player.y + PLAYER_HEIGHT / 2,
            );

            gameStateRef.current = "GAME_OVER";

            setGameState("GAME_OVER");

            saveRecord(elapsedTimeRef.current, "GAME_OVER");

            break;
          }
        }
      }

      // -----------------------------
      // 바닥
      // -----------------------------

      context.fillStyle = "#222";

      context.fillRect(0, GROUND_Y, CANVAS_WIDTH, 3);

      // -----------------------------
      // 장애물
      // -----------------------------

      obstaclesRef.current.forEach(drawObstacle);

      // -----------------------------
      // 플레이어
      // -----------------------------

      drawPlayer();

      // -----------------------------
      // 사망 파티클
      // -----------------------------

      deathParticlesRef.current = deathParticlesRef.current.filter(
        (particle) => {
          particle.x += particle.vx * deltaFrames;

          particle.y += particle.vy * deltaFrames;

          particle.vy += 0.08 * deltaFrames;

          particle.life -= 0.05 * deltaFrames;

          if (particle.life <= 0) {
            return false;
          }

          context.globalAlpha = particle.life;

          context.fillStyle = "#222";

          context.fillRect(
            particle.x,
            particle.y,
            particle.size,
            particle.size,
          );

          return true;
        },
      );

      context.globalAlpha = 1;

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <main className={isShaking ? "game shake" : "game"}>
      <header className="game-header">
        <div>
          <h1>RUN! 30</h1>

          <p>플레이어는 방향키를 조작해 점프하거나 숙여 장애물을 피하며
  30초 동안 살아남으면 성공하고, 장애물과 충돌하면 실패한다.</p>
        </div>

        <div className="game-info">
          <span>TIME {elapsedTime.toFixed(1)}s</span>
        </div>
      </header>

      {showRecords && (
        <div className="records-overlay">
          <div className="records-modal">
            <div className="records-header">
              <h2>플레이 기록</h2>

              <button
                className="records-close"
                onClick={() => setShowRecords(false)}
              >
                ×
              </button>
            </div>

            <div className="record-section">
              <div className="record-title">
                <h3>기본</h3>
                <span>{records.basic.length} / 10</span>
              </div>

              {records.basic.length === 0 ? (
                <p className="empty-record">아직 기록이 없습니다.</p>
              ) : (
                <div className="record-list">
                  {records.basic.map((record, index) => (
                    <div className="record-row" key={`basic-${index}`}>
                      <span>{index + 1}회</span>

                      <strong>{record.time.toFixed(1)}초</strong>

                      <span>
                        {record.result === "CLEAR" ? "CLEAR" : "GAME OVER"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="delete-record-button"
                onClick={() => clearRecords("basic")}
              >
                기본 기록 삭제
              </button>
            </div>

            <div className="record-divider" />

            <div className="record-section">
              <div className="record-title">
                <h3>움직임 줄이기</h3>
                <span>{records.easy.length} / 10</span>
              </div>

              {records.easy.length === 0 ? (
                <p className="empty-record">아직 기록이 없습니다.</p>
              ) : (
                <div className="record-list">
                  {records.easy.map((record, index) => (
                    <div className="record-row" key={`easy-${index}`}>
                      <span>{index + 1}회</span>

                      <strong>{record.time.toFixed(1)}초</strong>

                      <span>
                        {record.result === "CLEAR" ? "CLEAR" : "GAME OVER"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="delete-record-button"
                onClick={() => clearRecords("easy")}
              >
                움직임 줄이기 기록 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="game-area">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

        {gameState === "GAME_OVER" && (
          <div className="game-over">
            <h2>GAME OVER</h2>

            <p>장애물에 부딪혔습니다.</p>

            <button onClick={restartGame}>다시 시작</button>
          </div>
        )}

        {gameState === 'PAUSED' && (
  <div className="game-paused">
    <h2>PAUSED</h2>
    <p>P를 눌러 계속하기</p>
  </div>
)}

        {gameState === "CLEAR" && (
          <div className="game-over">
            <h2>CLEAR!</h2>

            <p>30초 동안 살아남았습니다.</p>

            <button onClick={restartGame}>다시 시작</button>
          </div>
        )}

        <div className="controls">
          <span>
            <strong>SPACE / ↑</strong> 점프
          </span>

          <span>
            <strong>↓</strong> 숙이기
          </span>

          <span>
            <strong>R</strong> 다시 시작
          </span>
          <span>
  <strong>P</strong> 일시정지
</span>
        </div>

        <div className="difficulty-controls">
          <span>난이도</span>

          <button
            className={difficulty === "basic" ? "active" : ""}
            onClick={() => changeDifficulty("basic")}
            disabled={gameState === "PLAYING"}
          >
            기본
          </button>

          <button
            className={difficulty === "easy" ? "active" : ""}
            onClick={() => changeDifficulty("easy")}
            disabled={gameState === "PLAYING"}
          >
            움직임 줄이기
          </button>

          <button
            className="records-button"
            onClick={() => setShowRecords(true)}
          >
            기록
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
