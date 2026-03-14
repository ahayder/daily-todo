import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance } from "tippy.js";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Heading1, Heading2, List, ListTodo, PenTool } from "lucide-react";

type CommandProps = {
  editor: any;
  range: any;
};

type CommandItem = {
  title: string;
  icon: React.ReactNode;
  command: (props: CommandProps) => void;
};

const COMMANDS: CommandItem[] = [
  {
    title: "Heading 1",
    icon: <Heading1 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    icon: <Heading2 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Bullet List",
    icon: <List size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Task List",
    icon: <ListTodo size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Drawing Board",
    icon: <PenTool size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({ type: "drawing" }).run();
    },
  },
];

const CommandList = forwardRef((props: { items: CommandItem[]; command: (item: CommandItem) => void }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  // Reset selection index when items change
  // We use useLayoutEffect or handle this directly when items change prop-wise


  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }
      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }
      if (event.key === "Enter") {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return null;
  }

  return (
    <div className="bg-popover border border-border rounded-lg shadow-md overflow-hidden flex flex-col p-1 w-56">
      {props.items.map((item: CommandItem, index: number) => (
        <button
          key={index}
          className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left w-full ${
            index === selectedIndex ? "bg-accent text-accent-foreground" : "text-popover-foreground hover:bg-accent/50"
          }`}
          onClick={() => selectItem(index)}
        >
          <div className="text-muted-foreground flex-shrink-0">{item.icon}</div>
          {item.title}
        </button>
      ))}
    </div>
  );
});

CommandList.displayName = "CommandList";

export const SlashCommand = Extension.create({
  name: "slash-command",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => {
          return COMMANDS.filter((item) =>
            item.title.toLowerCase().startsWith(query.toLowerCase())
          );
        },
        render: () => {
          let component: ReactRenderer;
          let popup: Instance[];

          return {
            onStart: (props) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              });

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },
            onUpdate(props) {
              component.updateProps(props);
              if (!props.clientRect) return;

              popup[0].setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },
            onKeyDown(props) {
              if (props.event.key === "Escape") {
                popup[0].hide();
                return true;
              }
              return (component.ref as any)?.onKeyDown(props);
            },
            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});
