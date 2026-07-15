export const enum StatusColor {
    RED,
    YELLOW,
    GREEN,
}

export interface Status {
    color: StatusColor,
    message: string,
}
