import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useEffect, useState } from "react";
import { Chess, Color, PieceSymbol, Square } from "chess.js";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");
const SQUARE_SIZE = width / 8;

const getPieceSymbol = (piece: PieceSymbol, color: Color) => {
  const symbols = {
    p: color === "w" ? "♙" : "♟",
    n: color === "w" ? "♘" : "♞",
    b: color === "w" ? "♗" : "♝",
    r: color === "w" ? "♖" : "♜",
    q: color === "w" ? "♕" : "♛",
    k: color === "w" ? "♔" : "♚",
  };
  return symbols[piece];
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface TimerProps {
  time: number;
  isActive: boolean;
  player: "White" | "Black";
}

const Timer = ({ time, isActive, player }: TimerProps) => {
  return (
    <View style={[styles.timer, isActive && styles.activeTimer]}>
      <Text style={styles.timerText}>{player}</Text>
      <Text style={styles.timerText}>{formatTime(time)}</Text>
    </View>
  );
};

const ControlButtons = ({
  onReset,
  isPlaying,
  onPlayPause,
}: {
  onReset: () => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}) => {
  return (
    <View style={styles.controlButtons}>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: isPlaying ? "#e74c3c" : "#2ecc71" },
        ]}
        onPress={onPlayPause}
      >
        <Text style={styles.buttonText}>{isPlaying ? "Pause" : "Play"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#3498db" }]}
        onPress={onReset}
      >
        <Text style={styles.buttonText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
};

interface ChessPieceProps {
  sq: { color: Color; square: Square; type: PieceSymbol } | null;
  column: number;
  row: number;
  onMove: (from: string, to: string) => void;
}

const ChessPiece = ({ sq, column, row, onMove }: ChessPieceProps) => {
  if (!sq) return null;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      isDragging.value = false;
      const targetCol = Math.round(
        (translateX.value + column * SQUARE_SIZE) / SQUARE_SIZE
      );
      const targetRow = Math.round(
        (translateY.value + row * SQUARE_SIZE) / SQUARE_SIZE
      );

      if (targetCol >= 0 && targetCol < 8 && targetRow >= 0 && targetRow < 8) {
        const targetPosition = `${String.fromCharCode(97 + targetCol)}${
          8 - targetRow
        }`;
        runOnJS(onMove)(sq.square, targetPosition);
      }

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    zIndex: isDragging.value ? 1000 : 1,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.piece, animatedStyle]}>
        <Text
          style={[
            styles.pieceText,
            { color: sq.color === "w" ? "#ffffff" : "#000000" },
          ]}
        >
          {getPieceSymbol(sq.type, sq.color)}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
};

const ChessBoard: React.FC = () => {
  const [chess] = useState(new Chess());
  const [board, setBoard] = useState(chess.board());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<"w" | "b">("w");
  // Timer states (in seconds)
  const [whiteTime, setWhiteTime] = useState(600); // 10 minutes
  const [blackTime, setBlackTime] = useState(600); // 10 minutes

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPlaying) {
      interval = setInterval(() => {
        if (currentPlayer === "w") {
          setWhiteTime((prev) => {
            if (prev <= 0) {
              setIsPlaying(false);
              alert("Black wins by timeout!");
              return 0;
            }
            return prev - 1;
          });
        } else {
          setBlackTime((prev) => {
            if (prev <= 0) {
              setIsPlaying(false);
              alert("White wins by timeout!");
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, currentPlayer]);
  const handleMove = (from: string, to: string) => {
    if (!isPlaying) {
      return; // Prevent moves when game is paused
    }

    try {
      // Check if it's the correct player's turn
      const piece = chess.get(from as Square);
      if (piece?.color !== currentPlayer) {
        console.log("Not your turn!");
        return;
      }

      const move = chess.move({
        from,
        to,
        promotion: "q",
      });

      if (move) {
        setBoard(chess.board());
        setCurrentPlayer(currentPlayer === "w" ? "b" : "w");

        // Check for game end conditions
        if (chess.isCheckmate()) {
          alert(
            `Checkmate! ${currentPlayer === "w" ? "White" : "Black"} wins!`
          );
          setIsPlaying(false);
        } else if (chess.isDraw()) {
          alert("Game Draw!");
          setIsPlaying(false);
        } else if (chess.isStalemate()) {
          alert("Stalemate!");
          setIsPlaying(false);
        }
      }
    } catch (e) {
      console.log("Invalid move");
    }
  };

  const handleReset = () => {
    chess.reset();
    setBoard(chess.board());
    setCurrentPlayer("w");
    setIsPlaying(false);
    setWhiteTime(600);
    setBlackTime(600);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <Timer
        time={blackTime}
        isActive={isPlaying && currentPlayer === "b"}
        player="Black"
      />
      <View style={styles.board}>
        {board.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((piece, colIndex) => {
              const squareColor =
                (rowIndex + colIndex) % 2 === 0 ? "#ECEFD4" : "#799159";
              return (
                <View
                  key={`${rowIndex}-${colIndex}`}
                  style={[styles.square, { backgroundColor: squareColor }]}
                >
                  {piece && (
                    <ChessPiece
                      sq={{
                        color: piece.color,
                        type: piece.type,
                        square: `${String.fromCharCode(97 + colIndex)}${
                          8 - rowIndex
                        }` as Square,
                      }}
                      row={rowIndex}
                      column={colIndex}
                      onMove={handleMove}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <Timer
        time={whiteTime}
        isActive={isPlaying && currentPlayer === "w"}
        player="White"
      />
      <ControlButtons
        onReset={handleReset}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#302E2B",
  },
  board: {
    width: width,
    height: width,
  },
  row: {
    flexDirection: "row",
  },
  square: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  piece: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  },
  pieceText: {
    fontSize: SQUARE_SIZE * 0.7,
  },

  //Control
  controlButtons: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    gap: 10,
  },

  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  gameInfo: {
    marginBottom: 20,
    alignItems: "center",
  },

  turnText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },

  controlContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#302E2B",
    paddingVertical: 20,
  },

  // TIMER
  timer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#34495e",
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
    width: width * 0.8,
    opacity: 0.8,
  },

  activeTimer: {
    backgroundColor: "#2980b9",
    opacity: 1,
  },

  timerText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
  },
});

export default ChessBoard;
