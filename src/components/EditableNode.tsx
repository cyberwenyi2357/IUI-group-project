import {NodeProps} from "@xyflow/react";
import {useEffect, useRef, useState} from "react";

export default function EditableNode({ id, data }: NodeProps) {
    const [label, setLabel] = useState(data.label);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [label]); // 当 label 改变时重新调整高度
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLabel(event.target.value);
    };
    return (
        <div style={{ padding: 10, border: '1px solid #000', borderRadius: 2 }}>
            <textarea
                ref={textareaRef}
                value={label as string}
                onChange={handleChange}
                style={{
                    width: '100%',
                    border: 'none',
                    textAlign: 'center',
                    resize: 'none',
                    overflow: 'hidden',
                    minHeight: '20px',
                    backgroundColor: 'transparent',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: '1.5',
                }}
                rows={1}

            />
        </div>
    );
}